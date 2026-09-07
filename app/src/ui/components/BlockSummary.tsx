import type { AppState, Block } from '../../domain/types';
import { FORMAT_LABELS, blockMetaLine, movementLine } from '../helpers';

export function BlockSummary({ state, block, index }: { state: AppState; block: Block; index: number }) {
  return (
    <div class="block-preview">
      <div class="block-preview-title">
        {block.title || `Block ${index + 1}`} · {FORMAT_LABELS[block.format]}
      </div>
      <div class="block-preview-meta">{blockMetaLine(block)}</div>
      {block.movements.map((bm, i) => (
        <div class="movement-line" key={`${bm.movementId}-${i}`}>
          {movementLine(state, bm)}
        </div>
      ))}
    </div>
  );
}
