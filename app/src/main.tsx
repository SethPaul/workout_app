import { effect } from '@preact/signals';
import { render } from 'preact';
import './app.css';
import { setVolume } from './ui/audio';
import { App } from './ui/App';
import { state } from './state/store';

effect(() => {
  setVolume(state.value?.settings.soundVolume ?? 1);
});

const root = document.getElementById('app');
if (root) render(<App />, root);
