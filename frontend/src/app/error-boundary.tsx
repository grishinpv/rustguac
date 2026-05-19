import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error boundary:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
          <div className="flex max-w-md flex-col items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden />
            <h1 className="text-base font-semibold">Something went wrong</h1>
            <p className="text-xs text-muted-foreground">{this.state.error.message}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
