// Estado da escola ligado ao Firebase, por tenant.
//
// Reaproveita o modelo do Passarinho (estado da escola num nó), mas escopado a
// /tenants/{tid}/state e autenticado pelas regras. A escrita por caminho (só o
// que mudou) é uma evolução planejada; nesta fase gravamos o estado do tenant
// via SDK, que já resolve auth e realtime.
//
// Também expõe o config da escola (/tenants/{tid}/config), só-leitura aqui.

import { useEffect, useRef, useState } from 'react';
import { ref, onValue, set, get } from 'firebase/database';
import { db } from './firebase.js';
import { paths } from './paths.js';
import { reducer, normalizeState } from '../domain/reducer.js';

export function useConfig(tid) {
  const [config, setConfig] = useState(undefined);
  useEffect(() => {
    get(ref(db, paths.config(tid)))
      .then((snap) => setConfig(snap.exists() ? snap.val() : {}))
      .catch(() => setConfig({}));
  }, [tid]);
  return config;
}

export function useTenantStore(tid, autor) {
  const [state, setState] = useState(undefined);
  const stateRef = useRef(EMPTY);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    const r = ref(db, paths.state(tid));
    return onValue(
      r,
      (snap) => {
        const s = normalizeState(snap.val());
        stateRef.current = s;
        setState(s);
      },
      (e) => setErro(e.message),
    );
  }, [tid]);

  function dispatch(action) {
    const atual = stateRef.current || EMPTY;
    const next = reducer(atual, { ...action, autor });
    if (next === atual) return;
    stateRef.current = next;
    setState(next); // otimista
    set(ref(db, paths.state(tid)), next).catch((e) => setErro(e.message));
  }

  return { state, dispatch, erro };
}

const EMPTY = normalizeState(null);
