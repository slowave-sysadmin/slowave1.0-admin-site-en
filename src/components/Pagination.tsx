"use client";

interface PaginationProps {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, total, limit, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (totalPages <= 1) {
    return (
      <div className="mt-4">
        <p className="text-[13px] text-gray-600 dark:text-gray-300">총 {total}건</p>
      </div>
    );
  }

  const pages: (number | string)[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-[13px] text-gray-600 dark:text-gray-300">
        총 {total}건 중 {(page - 1) * limit + 1}-{Math.min(page * limit, total)}건
      </p>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="px-3 py-1.5 text-[13px] border border-border-primary rounded-md bg-bg-card text-text-primary disabled:opacity-40 hover:bg-bg-hover"
        >
          이전
        </button>
        {pages.map((p, i) =>
          typeof p === "string" ? (
            <span key={`dots-${i}`} className="px-2 text-gray-600 dark:text-gray-300 text-[13px]">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`px-3 py-1.5 text-[13px] border rounded-md ${
                p === page
                  ? "bg-accent text-white border-accent"
                  : "bg-bg-card border-border-primary text-text-primary hover:bg-bg-hover"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="px-3 py-1.5 text-[13px] border border-border-primary rounded-md bg-bg-card text-text-primary disabled:opacity-40 hover:bg-bg-hover"
        >
          다음
        </button>
      </div>
    </div>
  );
}
