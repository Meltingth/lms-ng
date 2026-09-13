import { createRoot } from 'react-dom/client';
import { OperationsHud } from './features/hud/OperationsHud';
import '@lms-ng/ui-kit/tokens.css';
import './styles.css';
import './display.css';
createRoot(document.getElementById('root')!).render(<OperationsHud />);
