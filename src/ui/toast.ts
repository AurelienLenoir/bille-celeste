import { byId } from './dom';

export type Toast = (message: string, ms?: number) => void;

export const createToast = (): Toast => {
  const el = byId('toast');
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (message, ms = 1800) => {
    el.textContent = message;
    el.classList.add('on');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('on'), ms);
  };
};
