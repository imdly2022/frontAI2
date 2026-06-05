import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AdminHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { adminMigrationDump, adminMigrationRun } from "@/lib/admin.migration.functions";
import { Download, Database, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/migration")({
  head: () => ({ meta: [{ title: "Database Migration — Admin" }] }),
  component: MigrationPage,
});

function MigrationPage() {
  const dump = useServerFn(adminMigrationDump);
  const run = useServerFn(adminMigrationRun);
  const [includeData, setIncludeData] = useState(true);
  const [truncate, setTruncate] = useState(true);
  const [targetUrl, setTargetUrl] = useState("");
  const [confirmText, setConfirmText] = useState("");

  const dumpMut = useMutation({
    mutationFn: () => dump({ data: { includeData, truncate } }),
    onSuccess: (res) => {
      const blob = new Blob([res.sql], { type: "text/sql" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `migration-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.sql`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Dump 完成: ${res.stats.tables} 表, ${res.stats.rows} 行, ${res.sizeKb} KB`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Dump failed"),
  });

  const runMut = useMutation({
    mutationFn: () => run({ data: { targetUrl, includeData, truncate } }),
    onSuccess: (res) => {
      toast.success(`迁移完成: ${res.stats.tables} 表, ${res.stats.rows} 行, ${(res.ms / 1000).toFixed(1)}s`);
      setConfirmText("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Migration failed"),
  });

  const canRun = targetUrl.startsWith("postgres") && confirmText === "MIGRATE";

  return (
    <>
      <AdminHeader title="Database Migration" description="导出当前数据库 schema + 数据,或直接推送到目标 Postgres" />
      <div className="p-8 space-y-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">导出选项</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>包含数据</Label>
                <p className="text-xs text-muted-foreground">关闭则只导 schema/RLS/policies/functions</p>
              </div>
              <Switch checked={includeData} onCheckedChange={setIncludeData} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>先 TRUNCATE 目标表</Label>
                <p className="text-xs text-muted-foreground">推送前清空目标库相关表(避免主键冲突)</p>
              </div>
              <Switch checked={truncate} onCheckedChange={setTruncate} disabled={!includeData} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-4 w-4" /> 方式 1:下载 SQL 文件
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              生成完整 SQL 后下载到本地,自己跑 <code className="bg-muted px-1 rounded">psql "目标地址" -f migration.sql</code>
            </p>
            <Button onClick={() => dumpMut.mutate()} disabled={dumpMut.isPending}>
              {dumpMut.isPending ? "生成中..." : "生成并下载"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" /> 方式 2:直接推送到目标库
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-amber-700 dark:text-amber-300">
                <strong>危险操作!</strong> 会 DROP 目标库 public 下所有同名表并重新创建。确保连接的是空库或测试库。
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>目标 Postgres 连接串</Label>
              <Input
                placeholder="postgresql://user:password@host:5432/dbname"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                type="password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>输入 MIGRATE 确认</Label>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="MIGRATE" />
            </div>
            <Button
              variant="destructive"
              onClick={() => runMut.mutate()}
              disabled={!canRun || runMut.isPending}
            >
              {runMut.isPending ? "迁移中(可能需要几分钟)..." : "执行迁移"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
