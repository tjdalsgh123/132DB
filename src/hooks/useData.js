// 공통 데이터(store.js 의 D)가 바뀌면 다시 그리기
import { useSyncExternalStore } from 'react';
import { onChange } from '../lib/store.js';

let ver = 0;
onChange(() => { ver += 1; });
const subscribe = (cb) => onChange(cb);
const snap = () => ver;
export const useData = () => useSyncExternalStore(subscribe, snap, snap);
