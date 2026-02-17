import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
                    <div className="max-w-xl w-full bg-gray-800 rounded-lg shadow-xl p-8 border border-red-500/30">
                        <h1 className="text-2xl font-bold text-red-500 mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined">error</span>
                            Algo salió mal
                        </h1>
                        <p className="text-gray-300 mb-4">
                            La aplicación ha encontrado un error inesperado y no puede continuar.
                        </p>

                        <div className="bg-black/50 p-4 rounded-md overflow-auto max-h-60 mb-6 border border-gray-700">
                            <p className="text-red-400 font-mono text-sm mb-2">{this.state.error?.toString()}</p>
                            <pre className="text-gray-500 font-mono text-xs whitespace-pre-wrap">
                                {this.state.errorInfo?.componentStack}
                            </pre>
                        </div>

                        <button
                            onClick={() => window.location.reload()}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
                        >
                            Recargar Página
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
