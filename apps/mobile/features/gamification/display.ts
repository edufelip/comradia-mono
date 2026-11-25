import type { DsAchievementTierKey } from '@/constants/design-system';
import type { GamAchievementId, GamLevelId } from './model';

export const LEVEL_NAMES: Record<GamLevelId, string> = {
  botao: 'Botão',
  flor: 'Flor',
  ramalhete: 'Ramalhete',
  jardim: 'Jardim',
  primavera: 'Primavera',
};

export const BADGE_NAMES: Record<GamAchievementId, string> = {
  faisca: 'Primeira faísca',
  papo: 'Papo que rende',
  passo: 'Primeiro passo',
  vacuo: 'Sem vácuo',
  constancia: 'Constância',
  cartao: 'Cartão em dia',
  roda: 'Em roda',
  escuta: 'Escuta atenta',
  primavera: 'Primavera vermelha',
  maio: '1º de Maio',
  namorados: 'Dia dos Namorados',
};

export function medalTier(tier: number): DsAchievementTierKey {
  // eslint-disable-next-line comradia/no-raw-color -- These are medal tier IDs, not CSS colors.
  return tier >= 2 ? 'gold' : tier === 1 ? 'silver' : 'bronze';
}
