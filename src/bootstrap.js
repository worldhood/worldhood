import './style.css';
import './loading-screen.css';
import {installGameResilience} from './game-resilience.js';

const resilience=installGameResilience();
import('./main.js').catch(error=>resilience.fail(error,'startup'));
