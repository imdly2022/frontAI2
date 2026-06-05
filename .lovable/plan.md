# 实施计划

## 一、数据库改动

### 1. 新建 `public.users`(本站用户镜像)
- `id` (uuid pk), `newapi_user_id` (bigint unique), `username` (text unique), `email` (text unique), `display_name`, `created_at`, `last_login_at`
- 注册流程:先查本站 `users.email` 是否存在 → 再调 NewAPI 注册(不传 email)→ 写入本站 `users`
- 邮箱**仅本站存,不发给 NewAPI**

### 2. 改造 `affiliate_conversions`(已有)
- 新增 `note` (text) — 修改/调整原因
- 新增 `adjusted_by` (uuid, admin id, nullable)
- 新增 `adjusted_at` (timestamptz)
- status 扩展含义:`approved`(可提)/`paid`(已发)/`rejected`(无效)/`withdrawn`(申请提现中)/`converted`(已转余额)

### 3. 新建 `commission_ledger`(佣金流水,审计用)
- `id`, `affiliate_id`, `conversion_id` (nullable, 对应哪笔转化), `type` (`earn`/`adjust`/`convert_to_balance`/`withdraw_request`/`withdraw_paid`/`reject`), `amount_usd`, `balance_after`, `note` (required), `actor_id` (admin uuid or null=user/system), `created_at`
- 所有"余额变化"都走这张表,任何修改必须带 note

### 4. 新建 `withdrawal_requests`
- `id`, `affiliate_id`, `amount_usd`, `status` (`pending`/`approved`/`rejected`/`paid`), `contact_note` (用户填的联系方式),`admin_note`, `created_at`, `resolved_at`

### 5. `affiliates` 表加字段
- `available_balance_usd` (numeric, default 0) — 可提现/可转余额
- `pending_balance_usd` (累计未结算)
- 触发器:`commission_ledger` insert 时同步更新 affiliates 余额

### 6. `payment_intents`(已有)字段补充
- 加 `provider_trade_no` (text) — 支付网关订单号(epay 回调里的)
- 加索引

## 二、邀请系统统一

- 注册 register handler 移除给 NewAPI 传 aff_code 的逻辑(本来也没传,确认即可)
- 落地页 banner 提示用 `?ref=xxx`,NewAPI 短码不再宣传
- referrals 页面顶部 link 用本站 slug(已经是这样)

## 三、用户端 (`/app/referrals`)

- 余额卡片:Available / Pending / Lifetime
- 两个按钮:
  - **Convert to Balance** — 点击 → 确认弹窗(显示当前汇率,1 USD = X quota)→ 调 NewAPI admin API 给该用户充 quota → 写 `commission_ledger`(type=convert_to_balance,note='User self-converted')→ 扣 available_balance
  - **Withdraw** — 点击 → 弹窗"请联系管理员 @xxx 或填写下方表单" → 用户填联系方式和金额 → 写 `withdrawal_requests`(status=pending)→ 写 `commission_ledger`(type=withdraw_request)→ 冻结金额
- 新增"佣金明细"tab,显示 `commission_ledger` 时间线

## 四、用户端账单 (`/app/billing`)

三个 tab:
1. **Topups** — 来自 `payment_intents`,显示金额/时间/支付方式/订单号/网关单号/状态
2. **Usage** — 来自 NewAPI logs API,按模型/天聚合
3. **Commissions** — 来自 `commission_ledger`,带 type 筛选

## 五、Admin 端

### `/admin/users`(新)
- 用户列表表格:username / email / NewAPI ID / 注册时间 / 余额(实时拉 NewAPI)/ 来源 affiliate / 累计充值
- 筛选:邮箱搜索、注册时间区间、affiliate
- 行操作:查看详情(包含该用户所有 payment_intents、conversions)

### `/admin/orders`(新或扩 admin.payments)
- 所有 payment_intents 列表
- 筛选:状态、provider、用户邮箱、时间、网关订单号
- 行可展开看 meta、关联的 affiliate conversion

### `/admin/affiliates` 扩展
- 每个 affiliate 行展开:看所有 conversions
- conversion 行支持**修改金额/状态**:弹窗必填 note(原因:提现/无效订单/调整)→ 写 commission_ledger(type=adjust,带 note,actor=admin)→ 在订单详情(payment_intents 行)也打一条注释
- 处理 `withdrawal_requests`:approve/reject/mark_paid,必填 note

## 六、技术要点

- `commission_ledger` insert 用 db trigger 自动维护 `affiliates.available_balance_usd`,保证一致
- Convert to balance 走 server function,调 `newapiAdminAddQuota` (需要新增,封装 NewAPI 的 user/topup admin endpoint)
- 所有 admin 操作都记 actor_id,便于审计
- 用户余额拉取:加个 `newapiGetUserBalance(userId)` server fn,在 admin 用户列表里 batch 调用(并发限制 5)

## 七、不在本次范围

- 自动提现集成(PayPal/USDT API)— 先用人工 + 联系管理员
- API 消费明细分模型详细 breakdown — 先用 NewAPI 原生汇总
- 多币种 — 全部 USD

## 文件改动概览

- `supabase/migrations/*`:users / commission_ledger / withdrawal_requests / 字段补充 + trigger
- `src/lib/newapi.server.ts`:加 `newapiAdminAddQuota`, `newapiGetUserBalance`, `newapiListUsers`
- `src/lib/auth.functions.ts`:注册时写 public.users,email 唯一查本站表
- `src/lib/affiliate.postbacks.functions.ts` / 新 `src/lib/commissions.functions.ts`:convert/withdraw/list ledger
- `src/lib/admin.functions.ts`:listUsers, listOrders, adjustConversion, resolveWithdrawal
- `src/lib/payments/epay.server.ts`:写 provider_trade_no、佣金写 commission_ledger(type=earn)
- `src/routes/app.referrals.tsx`:加按钮和明细 tab
- `src/routes/app.billing.tsx`:三 tab 改造
- `src/routes/admin.users.tsx`(新),`src/routes/admin.orders.tsx`(新),`src/routes/admin.affiliates.tsx`(扩)

## 建议分阶段实施

太大一次做完风险高,建议拆 3 个 PR:
1. **Phase 1**:public.users 表 + admin 用户列表 + 余额拉取(回答你前半部分需求)
2. **Phase 2**:commission_ledger + 用户端转余额/提现按钮 + admin 调整佣金
3. **Phase 3**:账单三 tab + admin 订单页 + 筛选

要不要先按 Phase 1 开干?还是你想我一次全做完?
