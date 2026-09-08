import type { AppState, Block, BlockMovement } from '../../domain/types';
import { FORMAT_LABELS, blockMetaLine, movementLine, strengthSuggestionLine } from '../helpers';

export function BlockSummary({
  state,
  block,
  index,
  suggestLoads = false,
}: {
  state: AppState;
  block: Block;
  index: number;
  /** When true, strength-block movement lines show the suggested load/RPE (SPEC 9.9) instead of the raw prescription. */
  suggestLoads?: boolean;
}) {
  function line(bm: BlockMovement): string {
    if (suggestLoads && block.format === 'strength') return strengthSuggestionLine(state, block, bm);
    return movementLine(state, bm);
  }

  return (
    <div class="block-preview">
      <div class="block-preview-title">
        {block.title || `Block ${index + 1}`} · {FORMAT_LABELS[block.format]}
      </div>
      <div class="block-preview-meta">{blockMetaLine(block)}</div>
      {block.movements.map((bm, i) => (
        <div class="movement-line" key={`${bm.movementId}-${i}`}>
          {line(bm)}
        </div>
      ))}
    </div>
  );
}
