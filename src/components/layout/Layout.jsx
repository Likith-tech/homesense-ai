import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import ToastHost from '../ToastHost'
import DemoOverlay from '../DemoOverlay'
import Icon from '../ui/Icon'

export default function Layout({ children }) {
  const [navOpen, setNavOpen] = useState(false)
  const [lastPath, setLastPath] = useState(null)
  const { pathname } = useLocation()

  // Close the mobile drawer whenever the route changes, including programmatic
  // navigation from the guided demo. Adjusting during render (rather than in an
  // effect) re-renders before the browser paints, so the drawer never flashes.
  if (lastPath !== pathname) {
    setLastPath(pathname)
    if (navOpen) setNavOpen(false)
  }

  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [navOpen])

  return (
    <div className="relative z-10 min-h-full">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-white/6 bg-ink-900/60 backdrop-blur-xl lg:block">
        <Sidebar />
      </aside>

      {/* mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm"
            onClick={() => setNavOpen(false)}
          />
          <aside className="glass-strong absolute inset-y-0 left-0 w-[280px] max-w-[85vw] animate-float-in overflow-y-auto">
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-mist-400 transition hover:bg-white/5 hover:text-mist-100"
            >
              <Icon name="X" size={17} />
            </button>
            <Sidebar onNavigate={() => setNavOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-[264px]">
        <TopBar onOpenNav={() => setNavOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-5 sm:px-6 sm:pb-32 sm:pt-6">{children}</main>
      </div>

      <DemoOverlay />
      <ToastHost />
    </div>
  )
}
