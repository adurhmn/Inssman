import { FC } from 'react';
import Icon from '@options/components/common/icon/icon';
import { SortDirection } from '@models/sortModel';

type Props = {
  direction: SortDirection | null;
  onClick: () => void;
};

const SortIndicator: FC<Props> = ({ direction, onClick }) => {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="ml-1 p-1 hover:bg-slate-600 rounded transition-colors inline-flex items-center"
      aria-label={`Sort ${direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}`}
    >
      {direction === 'asc' && <Icon name="arrowUpLong" className="w-4 text-sky-400" />}
      {direction === 'desc' && <Icon name="arrowDownLong" className="w-4 text-sky-400" />}
      {!direction && <Icon name="arrowUpLong" className="w-4 opacity-30" />}
    </button>
  );
};

export default SortIndicator;
