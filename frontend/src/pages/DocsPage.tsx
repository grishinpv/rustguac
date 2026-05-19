import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchDocs } from '../services/services'
import type { DocSection } from '../types/api'

const sidebarCls =
  'block border-l-[3px] border-transparent px-4 py-2 text-sm no-underline hover:bg-[var(--surface)] hover:text-[var(--text)]'
const activeCls = 'border-l-[var(--primary)] bg-[var(--surface)] font-bold text-[var(--primary)]'

export function DocsPage() {
  const { data: docs = [], isError } = useQuery({ queryKey: ['docs'], queryFn: fetchDocs })
  const [slug, setSlug] = useState('')

  const active = useMemo(() => docs.find((d) => d.slug === slug) || docs[0], [docs, slug])

  useEffect(() => {
    if (!docs.length) return
    const h = window.location.hash ? window.location.hash.slice(1) : ''
    const pick = h && docs.some((d) => d.slug === h) ? h : docs[0]!.slug
    setSlug(pick)
    if (window.location.hash !== `#${pick}`) window.history.replaceState(null, '', `#${pick}`)
  }, [docs])

  function select(s: string) {
    setSlug(s)
    window.history.pushState(null, '', `#${s}`)
  }

  useEffect(() => {
    const onPop = () => {
      const h = window.location.hash.slice(1)
      if (h && docs.some((d) => d.slug === h)) setSlug(h)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [docs])

  if (isError) {
    return <div className="loading p-8">Failed to load documentation.</div>
  }

  if (!docs.length) {
    return <div className="loading p-8">Loading documentation…</div>
  }

  return (
    <div className="docs-layout flex min-h-[calc(100vh-180px)] border-t" style={{ borderColor: 'var(--border)' }}>
      <nav className="sidebar w-[240px] min-w-[180px] shrink-0 overflow-y-auto border-r py-3" style={{ borderColor: 'var(--border)' }}>
        {docs.map((d: DocSection) => (
          <a
            key={d.slug}
            href={`#${d.slug}`}
            className={sidebarCls + (active?.slug === d.slug ? ` ${activeCls}` : '')}
            style={{ color: active?.slug === d.slug ? undefined : 'var(--text-muted)' }}
            onClick={(e) => {
              e.preventDefault()
              select(d.slug)
            }}
          >
            {d.title}
          </a>
        ))}
      </nav>
      <div
        className="content docs-content max-w-[960px] flex-1 overflow-y-auto px-8 py-6"
        dangerouslySetInnerHTML={{ __html: active?.html || '' }}
      />
    </div>
  )
}
