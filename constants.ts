export const MOCK_ISSUES = [
  {
    id: 101,
    number: 42,
    title: "Race condition in data fetcher hook",
    body: "When component unmounts quickly, the data fetcher tries to set state on an unmounted component causing a React warning. We need to add an AbortController or an isMounted check.",
    state: "open",
    user: {
      login: "jdoe",
      avatar_url: "https://picsum.photos/32/32?random=1"
    },
    created_at: "2023-10-25T10:00:00Z",
    labels: [{ name: "bug", color: "d73a4a" }, { name: "high-priority", color: "b60205" }]
  },
  {
    id: 102,
    number: 56,
    title: "Add dark mode toggle to settings",
    body: "Users are requesting a dark mode. Please implement a theme context and a toggle switch in the user settings page. Ensure Tailwind dark classes are enabled.",
    state: "open",
    user: {
      login: "sarahc",
      avatar_url: "https://picsum.photos/32/32?random=2"
    },
    created_at: "2023-10-26T14:30:00Z",
    labels: [{ name: "feature", color: "0e8a16" }]
  },
  {
    id: 103,
    number: 89,
    title: "Fix accessibility labels on form inputs",
    body: "The login form inputs are missing associated labels or aria-labels, causing issues with screen readers. Run an audit and fix.",
    state: "open",
    user: {
      login: "a11y_bot",
      avatar_url: "https://picsum.photos/32/32?random=3"
    },
    created_at: "2023-10-27T09:15:00Z",
    labels: [{ name: "a11y", color: "f9d0c4" }]
  }
];

export const MOCK_FILES = {
  "src/hooks/useData.ts": `import { useState, useEffect } from 'react';

export function useData(url: string) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(url)
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      });
  }, [url]);

  return { data, loading };
}`,
  "src/components/LoginForm.tsx": `export const LoginForm = () => {
  return (
    <form>
      <input type="text" placeholder="Username" />
      <input type="password" placeholder="Password" />
      <button type="submit">Login</button>
    </form>
  )
}`,
  "src/context/ThemeContext.tsx": `import { createContext } from 'react';
export const ThemeContext = createContext('light');`
};