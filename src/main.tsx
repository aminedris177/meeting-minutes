import { render } from 'preact';
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/600.css';
import '@fontsource/cairo/700.css';
import './styles/main.css';
import './styles/components.css';
import './styles/tasks.css';
import './styles/minutes.css';
import './styles/dir.css';
import { App } from './app';
import { initialLang, setLang } from './i18n';
import { captureInstallPrompt } from './lib/install';
import { requestPersistentStorage } from './lib/platform';

setLang(initialLang());
captureInstallPrompt();
// اطلب التخزين الدائم أول ما التطبيق يفتح
void requestPersistentStorage();

render(<App />, document.getElementById('app')!);
