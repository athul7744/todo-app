type NotesPageSkeletonMode = "overview" | "editor";

type NotesNavigationRailSkeletonProps = {
  showHeader?: boolean;
};

function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

function EditorBlockRowSkeleton({ indent = 0, widthClassName = "w-full" }: { indent?: number; widthClassName?: string }) {
  return (
    <div className="flex items-start gap-2 px-1 py-0.5" style={{ marginLeft: indent * 18 }}>
      <div className="relative flex min-h-6 w-5 shrink-0 items-center justify-center self-stretch">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/35" />
      </div>
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        <Bone className={`h-4 ${widthClassName}`} />
        <Bone className="h-4 w-2/3" />
      </div>
    </div>
  );
}

export function NotesOverviewListSkeleton() {
  return (
    <div className="space-y-2 animate-stagger">
      <Bone className="h-16 w-full rounded-xl" />
      <Bone className="h-16 w-full rounded-xl" />
      <Bone className="h-16 w-5/6 rounded-xl" />
    </div>
  );
}

function NotesNavigationRailSectionSkeleton({ itemWidths }: { itemWidths: string[] }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3 rounded-lg py-1">
        <div className="flex items-center gap-2.5">
          <Bone className="h-6 w-6 rounded-lg" />
          <Bone className="h-4 w-28" />
        </div>
        <Bone className="h-4 w-4 rounded-full" />
      </div>
      <div className="space-y-2 overflow-hidden pl-8">
        {itemWidths.map((widthClassName, index) => (
          <div key={index} className="rounded-xl bg-muted/95 px-3 py-2.5">
            <Bone className={`h-3 ${widthClassName}`} />
            <div className="mt-2 flex gap-1.5">
              <Bone className="h-5 w-14 rounded-full" />
              <Bone className="h-5 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NotesNavigationRailSkeleton({ showHeader = true }: NotesNavigationRailSkeletonProps) {
  return (
    <div className="space-y-4 py-1">
      {showHeader ? (
        <div className="flex items-center gap-2.5">
          <Bone className="h-6 w-6 rounded-lg" />
          <div className="space-y-2">
            <Bone className="h-4 w-20" />
            <Bone className="h-3 w-24" />
          </div>
        </div>
      ) : null}
      <div className="space-y-2 rounded-2xl bg-muted/35 p-2">
        <NotesNavigationRailSectionSkeleton itemWidths={["w-3/4", "w-5/6"]} />
        <NotesNavigationRailSectionSkeleton itemWidths={["w-full", "w-2/3"]} />
        <NotesNavigationRailSectionSkeleton itemWidths={["w-1/2"]} />
      </div>
    </div>
  );
}

export function NotesEditorMainSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-2 gap-y-4">
        <Bone className="mt-1 h-9 w-9 rounded-full" />
        <Bone className="h-12 w-3/4" />
        <Bone className="mt-1 h-9 w-9 rounded-full" />
        <div className="col-start-2 flex gap-2">
          <Bone className="h-7 w-24 rounded-full" />
          <Bone className="h-7 w-28 rounded-full" />
          <Bone className="h-7 w-26 rounded-full" />
        </div>
        <div className="col-start-2 flex gap-2">
          <Bone className="h-7 w-18 rounded-full" />
          <Bone className="h-7 w-22 rounded-full" />
        </div>
        <div className="col-start-2 col-span-2 space-y-1.5 rounded-2xl bg-muted/20 py-1">
          <EditorBlockRowSkeleton widthClassName="w-4/5" />
          <EditorBlockRowSkeleton indent={1} widthClassName="w-3/4" />
          <EditorBlockRowSkeleton indent={1} widthClassName="w-5/6" />
          <EditorBlockRowSkeleton widthClassName="w-2/3" />
          <EditorBlockRowSkeleton indent={2} widthClassName="w-3/5" />
        </div>
      </div>
    </div>
  );
}

export function NotesDetailsRailSkeleton() {
  return (
    <div className="space-y-4 py-1">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bone className="h-4 w-4 rounded-full" />
          <Bone className="h-4 w-16" />
        </div>
        <Bone className="h-8 w-20 rounded-full" />
      </div>
      <div className="space-y-3">
        <Bone className="h-24 w-full rounded-xl" />
        <Bone className="h-12 w-full rounded-xl" />
        <Bone className="h-16 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function NotesPageSkeleton({ mode = "editor" }: { mode?: NotesPageSkeletonMode }) {
  if (mode === "overview") {
    return (
      <section className="grid gap-10 lg:grid-cols-2 animate-fade-slide-in">
        {Array.from({ length: 2 }).map((_, index) => (
          <section key={index} className="space-y-4">
            <div className="flex items-center gap-2">
              <Bone className="h-4 w-4 rounded-full" />
              <Bone className="h-4 w-28" />
            </div>
            <NotesOverviewListSkeleton />
          </section>
        ))}
      </section>
    );
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px] animate-fade-slide-in">
      <div className="hidden lg:block">
        <NotesNavigationRailSkeleton />
      </div>

      <NotesEditorMainSkeleton />

      <div className="hidden lg:block">
        <NotesDetailsRailSkeleton />
      </div>
    </section>
  );
}