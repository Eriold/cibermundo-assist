export const formatDate = (isoString: string) => {
  if (!isoString) return '-';

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '-';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  hours = hours || 12;

  return `${day}/${month}/${year} ${String(hours).padStart(2, '0')}:${minutes}${ampm}`;
};

export const formatDateOnly = (isoString: string) => {
  if (!isoString) return '-';

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '-';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};

export const getGestionBadge = (count: number | undefined | null) => {
  const current = count ?? 0;

  if (current === 0) {
    return {
      text: '0',
      bg: 'bg-gray-100 dark:bg-white/5',
      textColor: 'text-gray-500 dark:text-gray-400',
      border: '',
    };
  }

  if (current === 1) {
    return {
      text: '1',
      bg: 'bg-yellow-100 dark:bg-yellow-500/20',
      textColor: 'text-yellow-700 dark:text-yellow-400',
      border: 'border-l-4 border-yellow-400',
    };
  }

  if (current === 2) {
    return {
      text: '2',
      bg: 'bg-orange-100 dark:bg-orange-500/20',
      textColor: 'text-orange-700 dark:text-orange-400',
      border: 'border-l-4 border-orange-400',
    };
  }

  return {
    text: String(current),
    bg: 'bg-red-100 dark:bg-red-500/20',
    textColor: 'text-red-700 dark:text-red-400',
    border: 'border-l-4 border-red-500',
  };
};

export const getShipmentSizeBadge = (size: string | null | undefined) => {
  const normalized = typeof size === 'string' ? size.toUpperCase() : '';

  if (normalized === 'S') {
    return {
      label: 'S',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    };
  }

  if (normalized === 'M') {
    return {
      label: 'M',
      className: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    };
  }

  if (normalized === 'L') {
    return {
      label: 'L',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    };
  }

  if (normalized === 'XL') {
    return {
      label: 'XL',
      className: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    };
  }

  return {
    label: 'Sin dato',
    className: 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400',
  };
};
