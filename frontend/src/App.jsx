import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BrainCircuit,
  CalendarDays,
  Clock3,
  ExternalLink,
  Filter,
  GitBranch,
  Layers,
  Minus,
  Newspaper,
  Plus,
  Radio,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  TrendingUp,
} from 'lucide-react'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050'
const SOURCES = ['BBC', 'NPR', 'Guardian']
const VIEW_MODES = [
  { id: 'grouped', label: 'Grouped stories' },
  { id: 'all', label: 'All topics' },
  { id: 'single', label: 'Single articles' },
]
const VISUAL_MODES = [
  { id: 'board', label: 'Cluster board' },
  { id: 'map', label: 'Signal map' },
  { id: 'timeline', label: 'Timeline' },
]
const DATE_MODES = [
  { id: 'all', label: 'All time', hours: null },
  { id: '6h', label: '6h', hours: 6 },
  { id: '24h', label: '24h', hours: 24 },
  { id: '48h', label: '48h', hours: 48 },
]
const DEFAULT_THRESHOLD = 0.26
const PAGE_SIZE = 12
const INGESTION_STEPS = [
  { id: 'fetch', label: 'Fetch', icon: Newspaper },
  { id: 'extract', label: 'Extract', icon: Search },
  { id: 'score', label: 'Score', icon: BrainCircuit },
  { id: 'cluster', label: 'Cluster', icon: Layers },
]

function formatDate(value) {
  if (!value) return 'Unknown'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatAxisDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function timeValue(value) {
  return new Date(value).getTime()
}

function clusterKind(cluster) {
  return cluster.articleCount > 1 ? 'cluster' : 'single'
}

function sourceClass(sources) {
  if (sources.length > 1) return 'mixed'
  return (sources[0] || 'unknown').toLowerCase()
}

async function api(path, options) {
  const response = await fetch(`${API_BASE_URL}${path}`, options)
  const payload = await response.json()
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || 'Request failed')
  }
  return payload.data
}

function TextureSurface({ children, className = '' }) {
  return <section className={`texture-surface ${className}`}>{children}</section>
}

function SegmentedControl({ label, options, value, onChange }) {
  return (
    <div className="segmented-wrap" aria-label={label}>
      {options.map((option) => (
        <button
          className={value === option.id ? 'active' : ''}
          key={option.id}
          onClick={() => onChange(option.id)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <TextureSurface className="stat-card">
      <Icon size={18} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </TextureSurface>
  )
}

function SourceChips({ sources }) {
  return (
    <div className="source-stack">
      {sources.map((source) => (
        <span className={`source-chip ${source.toLowerCase()}`} key={source}>{source}</span>
      ))}
    </div>
  )
}

function SkeletonDashboard() {
  return (
    <div className="loading-dashboard" aria-label="Loading topics">
      <div className="loading-orbit">
        <span />
        <span />
        <span />
        <strong />
      </div>
      <div>
        <p className="eyebrow">Building cluster view</p>
        <h3>Scoring article similarity and drawing topic windows...</h3>
      </div>
      <div className="skeleton-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="skeleton-bubble" key={index} />
        ))}
      </div>
    </div>
  )
}

function IngestionStrip({ phase, status }) {
  const activeIndex = Math.max(0, INGESTION_STEPS.findIndex((step) => step.id === phase))

  return (
    <div className="ingestion-strip" role="status">
      <div>
        <strong>Ingestion running</strong>
        <span>{status}</span>
      </div>
      <div className="ingestion-pipeline" aria-hidden="true">
        {INGESTION_STEPS.map((step, index) => {
          const Icon = step.icon
          return (
            <span
              className={`${index < activeIndex ? 'complete' : ''} ${index === activeIndex ? 'active' : ''}`}
              key={step.id}
            >
              <Icon size={15} /> {step.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function Pagination({ page, pageSize, total, onChange }) {
  if (total <= pageSize) return null

  const pageCount = Math.ceil(total / pageSize)
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="pagination-bar">
      <span>{start}-{end} of {total}</span>
      <div className="pagination-actions">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)} type="button">
          Previous
        </button>
        <strong>{page} / {pageCount}</strong>
        <button disabled={page >= pageCount} onClick={() => onChange(page + 1)} type="button">
          Next
        </button>
      </div>
    </div>
  )
}

function durationLabel(startTime, endTime) {
  const duration = Math.max(timeValue(endTime) - timeValue(startTime), 0)
  const hours = Math.round(duration / (60 * 60 * 1000))
  if (hours <= 0) return 'Moment'
  if (hours < 24) return `${hours}h`
  const days = Math.max(1, Math.round(hours / 24))
  return `${days}d`
}

function mlConfidence(cluster) {
  const sourceBoost = Math.min(cluster.sources.length * 8, 24)
  const articleBoost = Math.min(Math.max(cluster.articleCount - 1, 0) * 9, 28)
  const termBoost = Math.min((cluster.topTerms?.length || 0) * 8, 18)
  return Math.min(96, 50 + sourceBoost + articleBoost + termBoost)
}

function representativeArticle(cluster) {
  return cluster.articles?.[0]
}

function ClusterBoard({ clusters, onOpen }) {
  if (!clusters.length) {
    return (
      <div className="empty-state">
        <Search size={30} />
        <p>No matching topics for the selected filters.</p>
      </div>
    )
  }

  const featured = clusters[0]
  const rest = clusters.slice(1)

  return (
    <div className="cluster-board">
      {featured && (
        <button className={`lead-cluster ${sourceClass(featured.sources)}`} onClick={() => onOpen(featured)} type="button">
          <div className="lead-cluster-copy">
            <p className="eyebrow"><Radio size={13} /> Lead clustered story</p>
            <h3>{featured.label}</h3>
            <p>{representativeArticle(featured)?.summary || representativeArticle(featured)?.body?.slice(0, 220) || 'A live topic assembled from related reporting across the feed.'}</p>
            <div className="lead-facts">
              <span><Newspaper size={14} /> {featured.articleCount} articles</span>
              <span><GitBranch size={14} /> {featured.sources.length} sources</span>
              <span><Clock3 size={14} /> {durationLabel(featured.startTime, featured.endTime)}</span>
            </div>
          </div>
          <div className="lead-cluster-model">
            <BrainCircuit size={22} />
            <strong>{mlConfidence(featured)}%</strong>
            <span>match strength</span>
            <SourceChips sources={featured.sources} />
          </div>
        </button>
      )}

      <div className="cluster-card-grid">
        {rest.map((cluster) => (
          <button className={`cluster-card ${sourceClass(cluster.sources)} ${clusterKind(cluster)}`} key={cluster.id} onClick={() => onOpen(cluster)} type="button">
            <div className="cluster-card-top">
              <span className="cluster-kind">{cluster.articleCount > 1 ? 'Cluster' : 'Single article'}</span>
              <span className="cluster-score"><BrainCircuit size={13} /> {mlConfidence(cluster)}%</span>
            </div>
            <h3>{cluster.label}</h3>
            <p>{representativeArticle(cluster)?.summary || representativeArticle(cluster)?.body?.slice(0, 150) || 'No summary available.'}</p>
            {cluster.topTerms?.length > 0 && (
              <div className="term-row compact-terms">
                {cluster.topTerms.slice(0, 3).map((term) => (
                  <span key={term}>{term}</span>
                ))}
              </div>
            )}
            <div className="cluster-card-footer">
              <SourceChips sources={cluster.sources} />
              <span>{formatDate(cluster.endTime)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function SignalMap({ clusters, onOpen }) {
  if (!clusters.length) {
    return (
      <div className="empty-state">
        <Search size={30} />
        <p>No matching topics for the selected filters.</p>
      </div>
    )
  }

  return (
    <div className="signal-map">
      {clusters.map((cluster, index) => {
        const size = Math.min(146, 82 + Math.max(cluster.articleCount - 1, 0) * 14)
        return (
          <button
            className={`signal-node-card ${sourceClass(cluster.sources)} ${clusterKind(cluster)}`}
            key={cluster.id}
            onClick={() => onOpen(cluster)}
            style={{
              '--signal-size': `${size}px`,
              '--signal-delay': `${(index % 10) * 38}ms`,
            }}
            type="button"
          >
            <span className="signal-bubble">
              <span className="signal-count">{cluster.articleCount}</span>
              <span className="signal-confidence">{mlConfidence(cluster)}%</span>
              {cluster.sources.slice(0, 4).map((source, sourceIndex) => (
                <span
                  className={`signal-source-dot dot-${sourceIndex} ${source.toLowerCase()}`}
                  key={source}
                  title={source}
                />
              ))}
            </span>
            <span className="signal-node-title">{cluster.label}</span>
            <span className="signal-node-meta">{cluster.sources.length} source{cluster.sources.length === 1 ? '' : 's'} · {durationLabel(cluster.startTime, cluster.endTime)}</span>
          </button>
        )
      })}
    </div>
  )
}

function Timeline({ clusters, onOpen }) {
  const bounds = useMemo(() => {
    if (!clusters.length) return null
    const starts = clusters.map((cluster) => timeValue(cluster.startTime))
    const ends = clusters.map((cluster) => timeValue(cluster.endTime))
    const min = Math.min(...starts)
    const max = Math.max(...ends)
    const padding = Math.max((max - min) * 0.04, 60 * 60 * 1000)
    return {
      min: min - padding,
      max: max + padding,
    }
  }, [clusters])

  if (!bounds) {
    return (
      <div className="empty-state">
        <Search size={30} />
        <p>No matching topics for the selected filters.</p>
      </div>
    )
  }

  const range = Math.max(bounds.max - bounds.min, 1)
  const ticks = Array.from({ length: 5 }).map((_, index) => bounds.min + (range / 4) * index)
  const chartClusters = clusters.slice(0, 48)
  const laneHeight = 76
  const chartHeight = Math.max(420, chartClusters.length * laneHeight + 96)

  return (
    <div className="timeline-shell">
      <div className="timeline-summary">
        <div>
          <p className="eyebrow">Activity windows</p>
          <h3>{chartClusters.length} topics plotted on one time axis</h3>
        </div>
        <span>{formatDate(bounds.min)} - {formatDate(bounds.max)}</span>
      </div>

      <div className="timeline-chart" style={{ '--timeline-height': `${chartHeight}px` }}>
        <div className="timeline-label-column" aria-hidden="true">
          <div className="timeline-label-spacer" />
          {chartClusters.map((cluster) => (
            <div className="timeline-row-label" key={cluster.id}>
              <strong>{cluster.label}</strong>
              <span>{cluster.articleCount} article{cluster.articleCount === 1 ? '' : 's'} · {durationLabel(cluster.startTime, cluster.endTime)} · {cluster.sources.join(', ')}</span>
            </div>
          ))}
        </div>

        <div className="timeline-plot">
          <div className="timeline-ruler">
            {ticks.map((tick) => (
              <span className="timeline-tick-label" key={tick} style={{ left: `${((tick - bounds.min) / range) * 100}%` }}>
                {formatAxisDate(tick)}
              </span>
            ))}
          </div>

          <div className="timeline-grid" aria-hidden="true">
            {ticks.map((tick) => (
              <span className="timeline-grid-line" key={tick} style={{ left: `${((tick - bounds.min) / range) * 100}%` }} />
            ))}
          </div>

          {chartClusters.map((cluster, index) => {
          const start = ((timeValue(cluster.startTime) - bounds.min) / range) * 100
          const span = ((timeValue(cluster.endTime) - timeValue(cluster.startTime)) / range) * 100
          const isSingle = clusterKind(cluster) === 'single'
            const width = isSingle ? 0 : Math.max(span, 2.8)
            const top = 60 + index * laneHeight

          return (
            <button
                className={`timeline-marker ${isSingle ? 'single' : 'grouped'} ${sourceClass(cluster.sources)}`}
              key={cluster.id}
              onClick={() => onOpen(cluster)}
                style={{
                  '--timeline-left': `${Math.min(Math.max(start, 0.5), 98)}%`,
                  '--timeline-width': `${Math.min(width, 100 - start)}%`,
                  '--timeline-top': `${top}px`,
                  '--timeline-opacity': cluster.intensity || 0.65,
                }}
                title={`${cluster.label} · ${formatDate(cluster.startTime)} - ${formatDate(cluster.endTime)}`}
              type="button"
            >
                <span className="timeline-shape" />
                <span className="timeline-marker-count">{cluster.articleCount}</span>
            </button>
          )
        })}
        </div>
      </div>
      {clusters.length > chartClusters.length && (
        <p className="timeline-note">Showing first {chartClusters.length} filtered topics to keep the time axis readable.</p>
      )}
    </div>
  )
}

function ArticleConstellation({ articles }) {
  return (
    <div className="article-constellation">
      {articles.map((article, index) => (
        <article className={`article-node node-${index % 5}`} key={article.id}>
          <div className="article-meta">
            <span>{article.source}</span>
            <span>{formatDate(article.publishedAt)}</span>
          </div>
          <h3>{article.title}</h3>
          <p>{article.summary || article.body?.slice(0, 240) || 'No summary available.'}</p>
          <a href={article.url} target="_blank" rel="noreferrer">
            Read original <ExternalLink size={14} />
          </a>
        </article>
      ))}
    </div>
  )
}

function DetailSignalMap({ cluster }) {
  const articles = cluster.articles || []
  const visibleArticles = articles.slice(0, 5)
  const hiddenCount = Math.max(articles.length - visibleArticles.length, 0)
  return (
    <div className="detail-evidence-panel">
      <div className="evidence-score">
        <BrainCircuit size={22} />
        <div>
          <strong>{mlConfidence(cluster)}%</strong>
          <span>Match strength</span>
        </div>
      </div>

      <div className="evidence-sources">
        <span>Source coverage</span>
        <SourceChips sources={cluster.sources} />
      </div>

      <div className="evidence-articles">
        {visibleArticles.map((article) => (
          <a
            className={`evidence-article-node ${article.source?.toLowerCase() || 'unknown'}`}
            href={article.url}
            key={article.id}
            rel="noreferrer"
            target="_blank"
            title={article.title}
          >
            <span>{article.source?.slice(0, 1) || 'N'}</span>
            <strong>{article.source || 'News'}</strong>
          </a>
        ))}
        {hiddenCount > 0 && (
          <span className="evidence-more">+{hiddenCount}</span>
        )}
      </div>
    </div>
  )
}

function ClusterDetailPage({ cluster, loading, onBack }) {
  if (loading) {
    return (
      <main className="app-shell">
        <div className="top-loader" aria-hidden="true" />
        <TextureSurface className="detail-page loading-page">
          <div className="loading-pulse" />
          <p>Loading grouped story...</p>
        </TextureSurface>
      </main>
    )
  }

  if (!cluster) {
    return (
      <main className="app-shell">
        <TextureSurface className="detail-page loading-page">
          <AlertCircle size={28} />
          <p>Cluster not found.</p>
          <button className="texture-button" onClick={onBack} type="button">
            <ArrowLeft size={17} /> Back to dashboard
          </button>
        </TextureSurface>
      </main>
    )
  }

  const isSingle = clusterKind(cluster) === 'single'
  const confidence = mlConfidence(cluster)

  return (
    <main className="app-shell detail-shell">
      <button className="back-link" onClick={onBack} type="button">
        <ArrowLeft size={18} /> Back to cluster map
      </button>

      <TextureSurface className={`detail-hero ${sourceClass(cluster.sources)}`}>
        <div className="detail-hero-copy">
          <p className="eyebrow">{isSingle ? 'Single article' : 'Grouped topic'}</p>
          <h1>{cluster.label}</h1>
          <div className="detail-facts">
            <span><Layers size={15} /> {cluster.articleCount} article{cluster.articleCount === 1 ? '' : 's'}</span>
            <span><CalendarDays size={15} /> {formatDate(cluster.startTime)} - {formatDate(cluster.endTime)}</span>
            <span><GitBranch size={15} /> {cluster.sources.length} source{cluster.sources.length === 1 ? '' : 's'}</span>
            <span><BrainCircuit size={15} /> {confidence}% match strength</span>
          </div>
        </div>
        <div className="detail-orbit" aria-hidden="true">
          <span>{confidence}%</span>
        </div>
      </TextureSurface>

      <section className="detail-grid">
        <TextureSurface className="explain-card">
          <p className="eyebrow">Model evidence</p>
          {cluster.topTerms?.length > 0 ? (
            <>
              <p className="explain-copy">
                These stories crossed the TF-IDF similarity threshold using shared weighted terms and overlapping source context.
              </p>
              <div className="term-row">
                {cluster.topTerms.map((term) => (
                  <span key={term}>{term}</span>
                ))}
              </div>
            </>
          ) : (
            <p className="explain-copy">
              This is a single article, so it is shown as its own topic until another story is similar enough to join it.
            </p>
          )}
          <DetailSignalMap cluster={cluster} />
          <SourceChips sources={cluster.sources} />
        </TextureSurface>

        <TextureSurface className="article-map-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Article evidence</p>
              <h2>{isSingle ? 'One report' : 'Reports behind this cluster'}</h2>
            </div>
            <span>{cluster.articleCount} total</span>
          </div>
          <ArticleConstellation articles={cluster.articles} />
        </TextureSurface>
      </section>
    </main>
  )
}

function App() {
  const [clusters, setClusters] = useState([])
  const [selectedSources, setSelectedSources] = useState(SOURCES)
  const [viewMode, setViewMode] = useState('grouped')
  const [visualMode, setVisualMode] = useState('board')
  const [dateMode, setDateMode] = useState('all')
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD)
  const [searchQuery, setSearchQuery] = useState('')
  const [crossSourceOnly, setCrossSourceOnly] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedCluster, setSelectedCluster] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [ingestionPhase, setIngestionPhase] = useState('fetch')
  const [pageNumber, setPageNumber] = useState(1)
  const [status, setStatus] = useState('Ready')
  const [error, setError] = useState('')

  const sourceQuery = selectedSources.length
    ? `?sources=${encodeURIComponent(selectedSources.join(','))}`
    : ''

  const loadTimeline = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const separator = sourceQuery ? '&' : '?'
      const data = await api(`/clusters/playground${sourceQuery}${separator}threshold=${threshold.toFixed(2)}`)
      setClusters(data.clusters)
      setStatus(`${data.clusters.length} topics at ${data.threshold.toFixed(2)} similarity`)
    } catch (requestError) {
      setError(requestError.message)
      setStatus('Unable to load timeline')
    } finally {
      setLoading(false)
    }
  }, [sourceQuery, threshold])

  const loadCluster = useCallback(async (id) => {
    if (!id) {
      setSelectedCluster(null)
      return
    }

    setDetailLoading(true)
    try {
      const data = await api(`/clusters/${id}`)
      setSelectedCluster(data)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  async function refreshData() {
    setRefreshing(true)
    setIngestionPhase('fetch')
    setError('')
    try {
      const job = await api('/ingest/trigger', { method: 'POST' })
      setStatus('Fetching articles from feeds')

      let current = job
      let pollCount = 0
      while (current.status === 'pending' || current.status === 'running') {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        current = await api(`/ingest/status/${job.jobId}`)
        pollCount += 1
        const nextPhase = INGESTION_STEPS[Math.min(pollCount, INGESTION_STEPS.length - 1)]?.id || 'cluster'
        setIngestionPhase(nextPhase)
        const phaseLabel = INGESTION_STEPS.find((step) => step.id === nextPhase)?.label || 'Cluster'
        setStatus(`${phaseLabel} in progress`)
      }

      if (current.status === 'failed') {
        throw new Error(current.error || 'Ingestion failed')
      }

      setIngestionPhase('cluster')
      setStatus(`Rebuilt ${current.clusterCount} topics`)
      await loadTimeline()
    } catch (requestError) {
      setError(requestError.message)
      setStatus('Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  function openCluster(cluster) {
    if (cluster?.articles) {
      setSelectedCluster(cluster)
      setSelectedId(null)
    } else {
      setSelectedCluster(null)
      setSelectedId(cluster?.id)
    }
    setPage('detail')
  }

  useEffect(() => {
    loadTimeline()
  }, [loadTimeline])

  useEffect(() => {
    setPageNumber(1)
  }, [crossSourceOnly, dateMode, searchQuery, selectedSources, threshold, viewMode, visualMode])

  useEffect(() => {
    if (selectedId) {
      loadCluster(selectedId)
    }
  }, [loadCluster, selectedId])

  const stats = useMemo(() => {
    const grouped = clusters.filter((cluster) => cluster.articleCount > 1)
    const singles = clusters.filter((cluster) => cluster.articleCount === 1)
    const crossSource = grouped.filter((cluster) => cluster.sources.length > 1)
    return {
      total: clusters.length,
      grouped: grouped.length,
      singles: singles.length,
      crossSource: crossSource.length,
    }
  }, [clusters])

  const visibleClusters = useMemo(() => {
    const dateFilter = DATE_MODES.find((mode) => mode.id === dateMode)
    const cutoff = dateFilter?.hours
      ? Date.now() - dateFilter.hours * 60 * 60 * 1000
      : null
    const query = searchQuery.trim().toLowerCase()

    return [...clusters]
      .filter((cluster) => {
        if (viewMode === 'grouped' && cluster.articleCount <= 1) return false
        if (viewMode === 'single' && cluster.articleCount !== 1) return false
        if (crossSourceOnly && cluster.sources.length <= 1) return false
        if (cutoff && timeValue(cluster.endTime) < cutoff) return false
        if (!query) return true
        return [
          cluster.label,
          ...(cluster.topTerms || []),
          ...cluster.sources,
        ].join(' ').toLowerCase().includes(query)
      })
      .sort((a, b) => {
        if (visualMode === 'board' || visualMode === 'map') {
          return b.articleCount - a.articleCount || timeValue(b.endTime) - timeValue(a.endTime)
        }
        return timeValue(b.endTime) - timeValue(a.endTime)
      })
  }, [clusters, crossSourceOnly, dateMode, searchQuery, viewMode, visualMode])

  const pageCount = Math.max(1, Math.ceil(visibleClusters.length / PAGE_SIZE))
  const safePageNumber = Math.min(pageNumber, pageCount)
  const pagedClusters = useMemo(() => {
    const start = (safePageNumber - 1) * PAGE_SIZE
    return visibleClusters.slice(start, start + PAGE_SIZE)
  }, [safePageNumber, visibleClusters])

  function toggleSource(source) {
    setSelectedSources((current) => (
      current.includes(source)
        ? current.filter((item) => item !== source)
        : [...current, source]
    ))
  }

  if (page === 'detail') {
    return (
      <ClusterDetailPage
        cluster={selectedCluster}
        loading={detailLoading}
        onBack={() => setPage('dashboard')}
      />
    )
  }

  return (
    <main className="app-shell">
      {(loading || detailLoading) && <div className="top-loader" aria-hidden="true" />}
      <section className="topbar">
        <div>
          <h1>News Pulse</h1>
        </div>
        <button className="texture-button" onClick={refreshData} disabled={refreshing} type="button">
          <RefreshCcw size={18} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Refreshing' : 'Refresh data'}
        </button>
      </section>

      <section className="metric-grid">
        <StatCard label="Topics analyzed" value={stats.total} icon={Activity} />
        <StatCard label="Grouped stories" value={stats.grouped} icon={Layers} />
        <StatCard label="Cross-source" value={stats.crossSource} icon={TrendingUp} />
        <StatCard label="Single articles" value={stats.singles} icon={Search} />
      </section>

      <TextureSurface className="control-deck">
        <div className="filter-row">
          <div className="filter-group" aria-label="Source filters">
            <Filter size={17} />
            {SOURCES.map((source) => (
              <button
                className={selectedSources.includes(source) ? 'active' : ''}
                key={source}
                onClick={() => toggleSource(source)}
                type="button"
              >
                {source}
              </button>
            ))}
          </div>

          <label className="search-box">
            <Search size={16} />
            <input
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search topics, terms, sources"
              type="search"
              value={searchQuery}
            />
          </label>

          <label className="check-filter">
            <input
              checked={crossSourceOnly}
              onChange={(event) => setCrossSourceOnly(event.target.checked)}
              type="checkbox"
            />
            Cross-source only
          </label>
        </div>

        <div className="filter-row compact">
          <SegmentedControl label="Topic scope" onChange={setViewMode} options={VIEW_MODES} value={viewMode} />
          <SegmentedControl label="Visualization" onChange={setVisualMode} options={VISUAL_MODES} value={visualMode} />
          <SegmentedControl label="Date range" onChange={setDateMode} options={DATE_MODES} value={dateMode} />
          <div className="status-line">
            <Clock3 size={16} />
            <span>{status}</span>
          </div>
        </div>

        <div className="threshold-playground">
          <div className="threshold-copy">
            <p className="eyebrow"><SlidersHorizontal size={13} /> Similarity playground</p>
            <strong>TF-IDF threshold {threshold.toFixed(2)}</strong>
          </div>
          <div className="threshold-control">
            <button
              aria-label="Loosen TF-IDF threshold"
              className="threshold-step"
              onClick={() => setThreshold((value) => Math.max(0.05, Number((value - 0.01).toFixed(2))))}
              type="button"
            >
              <Minus size={15} />
            </button>
            <span>Loose</span>
            <input
              aria-label="TF-IDF similarity threshold"
              max="0.65"
              min="0.05"
              onChange={(event) => setThreshold(Number(event.target.value))}
              onInput={(event) => setThreshold(Number(event.target.value))}
              step="0.01"
              type="range"
              value={threshold}
            />
            <span>Strict</span>
            <button
              aria-label="Increase TF-IDF threshold"
              className="threshold-step"
              onClick={() => setThreshold((value) => Math.min(0.65, Number((value + 0.01).toFixed(2))))}
              type="button"
            >
              <Plus size={15} />
            </button>
          </div>
          <button className="reset-threshold" onClick={() => setThreshold(DEFAULT_THRESHOLD)} type="button">
            Reset
          </button>
        </div>
      </TextureSurface>

      {error && (
        <div className="error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {refreshing && <IngestionStrip phase={ingestionPhase} status={status} />}

      <TextureSurface className="visual-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow"><SlidersHorizontal size={13} /> {VISUAL_MODES.find((mode) => mode.id === visualMode)?.label}</p>
            <h2>{VIEW_MODES.find((mode) => mode.id === viewMode)?.label}</h2>
          </div>
          <span>{loading ? 'Loading' : `${visibleClusters.length} shown`}</span>
        </div>

        {loading ? (
          <SkeletonDashboard />
        ) : visualMode === 'board' ? (
          <>
            <Pagination onChange={setPageNumber} page={safePageNumber} pageSize={PAGE_SIZE} total={visibleClusters.length} />
            <ClusterBoard clusters={pagedClusters} onOpen={openCluster} />
          </>
        ) : visualMode === 'map' ? (
          <>
            <Pagination onChange={setPageNumber} page={safePageNumber} pageSize={PAGE_SIZE} total={visibleClusters.length} />
            <SignalMap clusters={pagedClusters} onOpen={openCluster} />
          </>
        ) : (
          <>
            <Pagination onChange={setPageNumber} page={safePageNumber} pageSize={PAGE_SIZE} total={visibleClusters.length} />
            <Timeline clusters={pagedClusters} onOpen={openCluster} />
          </>
        )}
      </TextureSurface>
    </main>
  )
}

export default App
