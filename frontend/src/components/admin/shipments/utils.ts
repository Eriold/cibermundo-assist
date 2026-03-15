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
