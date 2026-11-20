import { PageHeader, Panel } from "@/components/Panel";
import type { DashboardData } from "@/lib/data/builders";
import { formatKst } from "@/lib/domain/format";
import type { Platform } from "@/lib/domain/types";
import { GateQuadrantChart } from "./GateQuadrantChart";
import { KpiGrid, YtKpiGrid } from "./KpiGrid";
import { LatestEpisodeCard } from "./LatestEpisodeCard";
import { MoreSection } from "./MoreSection";
import { PlatformTabs } from "./PlatformTabs";
import { RecentEpisodes } from "./RecentEpisodes";
import { StatusCard } from "./StatusCard";
import { YtLatestCard } from "./YtLatestCard";

/** 주소의 ?p= 값을 탭으로. 모르는 값은 인스타 */
export const platformOf = (p: string | string[] | undefined): Platform => (p === "yt" ? "yt" : "ig");

/**
 * 인스타·유튜브는 알고리즘이 달라 탭으로 나눠 따로 판정한다.
 * 폰 첫 화면: 지금 상황(문장) → 최신 편 숫자. 나머지(합계·관문 지도·최근 편)는 "더 보기"로 접는다.
 * 데스크톱은 전부 펼쳐 둔다.
 */
export function DashboardScreen({ data, platform, basePath }: { data: DashboardData; platform: Platform; basePath: string }) {
  const home = data[platform];
  return (
    <div className="flex flex-col gap-4 xl:gap-5">
      <PageHeader title="홈" subtitle={`@tech.rano · ${formatKst(data.now)} 기준`} />
      <PlatformTabs value={platform} basePath={basePath} />

      {home.latest ? (
        <div className="grid gap-4 xl:grid-cols-12 xl:gap-5">
          <div className="xl:col-span-7">
            {home.diagnosis ? <StatusCard episode={home.latest.episode} diagnosis={home.diagnosis} basePath={basePath} /> : null}
          </div>
          <div className="xl:col-span-5">
            {platform === "ig" ? (
              <LatestEpisodeCard card={data.ig.latest!} basePath={basePath} />
            ) : (
              <YtLatestCard card={data.yt.latest!} basePath={basePath} />
            )}
          </div>
        </div>
      ) : (
        <Panel className="p-5 text-sm text-muted-foreground">아직 게시된 편이 없다. 첫 편을 올리면 15분 안에 여기에 나온다.</Panel>
      )}

      <MoreSection label="전체 현황 더 보기 · 합계 · 관문 지도 · 최근 편">
        {platform === "ig" ? <KpiGrid kpis={data.ig.kpis} /> : <YtKpiGrid kpis={data.yt.kpis} />}
        <div className="grid gap-4 xl:grid-cols-12 xl:gap-5">
          <div className="xl:col-span-7">
            {/* 탭을 바꾸면 선택한 점을 새로 고르도록 key로 다시 만든다 */}
            <GateQuadrantChart key={platform} platform={platform} points={home.quadrant} excluded={home.excluded} basePath={basePath} />
          </div>
          <div className="xl:col-span-5">
            <RecentEpisodes episodes={home.recent} platform={platform} basePath={basePath} />
          </div>
        </div>
      </MoreSection>
    </div>
  );
}
