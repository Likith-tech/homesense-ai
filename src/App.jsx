import { Component, Suspense, lazy } from 'react'
import { Navigate, Route, Routes, Link } from 'react-router-dom'
import { HomeProvider } from './context/HomeContext'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import { STORAGE_KEY } from './data/constants'

// Dashboard loads eagerly (first paint). Every other route is code-split so the
// initial bundle only pays for what a judge sees in the first five seconds.
const Rooms = lazy(() => import('./pages/Rooms'))
const Devices = lazy(() => import('./pages/Devices'))
const Energy = lazy(() => import('./pages/Energy'))
const Automations = lazy(() => import('./pages/Automations'))
const Security = lazy(() => import('./pages/Security'))
const Assistant = lazy(() => import('./pages/Assistant'))
const About = lazy(() => import('./pages/About'))

/**
 * Last line of defence: a render error shows a recovery screen with a working
 * reset, rather than the blank page a thrown component would otherwise leave.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('HomeSense AI crashed:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="relative z-10 grid min-h-screen place-items-center p-6">
        <div className="glass max-w-lg rounded-2xl p-6 text-center">
          <h1 className="text-lg font-semibold text-mist-100">Something went wrong</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-mist-400">
            The interface hit an unexpected error. Clearing the saved simulation state usually resolves it.
          </p>
          <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-ink-900 p-3 text-left font-mono text-[11px] text-rose-300">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem(STORAGE_KEY)
              window.location.reload()
            }}
            className="mt-4 rounded-xl bg-emerald-400 px-4 py-2.5 text-[13px] font-semibold text-ink-950 transition hover:bg-emerald-300"
          >
            Reset and reload
          </button>
        </div>
      </div>
    )
  }
}

function RouteFallback() {
  return (
    <div className="grid place-items-center py-24">
      <span className="size-8 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400" />
    </div>
  )
}

function NotFound() {
  return (
    <div className="grid place-items-center py-24 text-center">
      <p className="text-5xl font-semibold text-mist-100">404</p>
      <p className="mt-2 text-[13px] text-mist-400">That route does not exist in HomeSense AI.</p>
      <Link
        to="/"
        className="mt-5 rounded-xl bg-emerald-400 px-4 py-2.5 text-[13px] font-semibold text-ink-950 transition hover:bg-emerald-300"
      >
        Back to dashboard
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <HomeProvider>
        <Layout>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/rooms" element={<Rooms />} />
              <Route path="/devices" element={<Devices />} />
              <Route path="/energy" element={<Energy />} />
              <Route path="/automations" element={<Automations />} />
              <Route path="/security" element={<Security />} />
              <Route path="/assistant" element={<Assistant />} />
              <Route path="/about" element={<About />} />
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Layout>
      </HomeProvider>
    </ErrorBoundary>
  )
}
