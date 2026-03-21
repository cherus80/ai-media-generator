import React from 'react';

type ExampleCardsSkeletonProps = {
  cardCount?: number;
  testId?: string;
};

export const ExampleCardsSkeleton: React.FC<ExampleCardsSkeletonProps> = ({
  cardCount = 6,
  testId,
}) => (
  <div
    data-testid={testId}
    className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 justify-items-center"
  >
    {Array.from({ length: cardCount }, (_, index) => (
      <div
        key={index}
        className="w-full max-w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow"
      >
        <div className="h-60 w-full animate-pulse bg-slate-200" />
        <div className="space-y-3 p-5">
          <div className="h-6 w-3/4 animate-pulse rounded bg-slate-200" />
          <div className="flex gap-2">
            <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200" />
            <div className="h-6 w-16 animate-pulse rounded-full bg-slate-200" />
          </div>
          <div className="h-10 w-full animate-pulse rounded-lg bg-slate-200" />
        </div>
      </div>
    ))}
  </div>
);
