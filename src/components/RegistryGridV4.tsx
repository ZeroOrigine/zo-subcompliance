'use client';

import { useMemo, useState } from 'react';

export interface GridProduct {
  slug: string; name: string; tagline: string | null; url: string | null;
  category?: string | null; launched_at?: string | null;
}

/** The registry grid. Generated from the database; chips actually filter. */
export default function RegistryGridV4({ products, costs }: {
  products: GridProduct[];
  costs: Record<string, number>;
}) {
  const [cat, setCat] = useState('All');
  const cats = useMemo(
    () => ['All', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean) as string[])).sort()],
    [products],
  );
  const shown = products.filter((p) => cat === 'All' || p.category === cat);

  return (
    <>
      {cats.length > 2 && (
        <div className="filters">
          {cats.map((c) => (
            <button key={c} className={`chip${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>
              {c === 'All' ? 'All' : c[0].toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      )}
      <div className="grid">
        {shown.map((p) => {
          const cost = costs[`zo-${p.slug}`];
          return (
            <a key={p.slug} className="p" href={p.url ?? '#'} target="_blank" rel="noopener noreferrer">
              <div className="badge"><span className="d"></span>Live{p.launched_at ? ' · born autonomously' : ''}</div>
              <h3>{p.name}</h3>
              <div className="tag">{p.tagline}</div>
              <div className="num">
                <span>{p.category ?? '·'}</span>
                <span style={{ color: cost ? 'var(--alive)' : undefined }}>{cost ? `$${cost.toFixed(2)}` : '·'}</span>
              </div>
            </a>
          );
        })}
      </div>
    </>
  );
}
