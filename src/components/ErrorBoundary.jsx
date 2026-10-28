import React from "react";

// Without this, an uncaught render error anywhere in the page content (e.g. a
// chart library choking on malformed data) unmounts the entire React tree,
// including AuthProvider above it - which looks exactly like being logged out.
// Catching it here keeps auth/session state intact and shows a recoverable
// message instead of a blank app.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught an error:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-20 text-center gap-3">
          <h2 className="text-lg font-semibold text-slate-800">Something went wrong loading this page.</h2>
          <p className="text-sm text-slate-500">Your session is still active.</p>
          <button
            onClick={this.handleReset}
            className="mt-2 px-4 py-2 rounded-lg bg-sky-700 text-white hover:bg-sky-900"
            type="button"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
