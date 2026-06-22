import { useVisibleNodeUuids } from "@/hooks/useNode";
import { useHomepagePingOverview } from "@/hooks/usePingMini";
import { NodeCard } from "./NodeCard";

export function NodeGrid() {
  const uuids = useVisibleNodeUuids();
  useHomepagePingOverview();

  if (uuids.length === 0) {
    return (
      <div className="flex h-[40vh] flex-col items-center justify-center gap-2 text-[var(--text-tertiary)]">
        <span className="text-[15px]">尚未连接到任何节点</span>
        <span className="text-[12px]">等待后端推送或前往管理后台添加</span>
      </div>
    );
  }

  return (
    <div
      className="grid gap-4 xl:gap-5"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))" }}
    >
      {uuids.map((uuid) => (
        <div key={uuid}>
          <NodeCard uuid={uuid} />
        </div>
      ))}
    </div>
  );
}
