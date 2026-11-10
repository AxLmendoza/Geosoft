import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastContainer } from 'react-toastify'
import 'mapbox-gl/dist/mapbox-gl.css'
import 'react-toastify/dist/ReactToastify.css'
import './index.css'
import Router from './router'
import ReloadPrompt from './components/pwa/ReloadPrompt'
import { MotionProvider } from './components/ui/Motion'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionProvider>
        <Router />
        <ReloadPrompt />
        <ToastContainer position="top-center" autoClose={3500} newestOnTop pauseOnFocusLoss={false} />
      </MotionProvider>
    </QueryClientProvider>
  </StrictMode>,
)
