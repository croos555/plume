import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/app.css'
import './styles/markdown.css'

// No StrictMode: its double effects would consume the files handed to this window twice
createRoot(document.getElementById('root')!).render(<App />)
