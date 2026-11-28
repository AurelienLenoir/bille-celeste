import { t } from '../../i18n';
import type { WalletStore } from '../../meta/store';
import { useStore } from '../hooks';

/** The feather icon of the in-game currency. */
export const FeatherIcon = () => (
  <svg class="feather-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M20 3c-6 0-11 4-12.5 10.5L5 21h1.6l1.6-4.2C14 16 19 11 20 3z"
      fill="#fff4c2"
      stroke="#d99a1e"
      stroke-width="1.4"
    />
    <path d="M8.6 15.4 16 8" stroke="#d99a1e" stroke-width="1.2" fill="none" />
  </svg>
);

/** Feathers owned, as a pill for the menu headers. */
export const FeatherCount = ({ wallet }: { wallet: WalletStore }) => {
  const feathers = useStore(wallet, (s) => s.wallet.feathers);
  return (
    <span class="feathers" aria-label={t().shop.feathers(feathers)}>
      <FeatherIcon />
      {feathers}
    </span>
  );
};
