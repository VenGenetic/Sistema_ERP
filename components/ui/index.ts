/**
 * Primitivas de interfaz de DropshipERP.
 *
 *   import { Button, Input, StatCard, Badge, Modal } from '../components/ui';
 *
 * Si necesitas las clases sueltas (para un elemento que no tiene primitiva,
 * o para componer con markup existente):
 *
 *   import { cn, table, badge } from '../components/ui/styles';
 */

export { cn } from './styles';
export * from './styles';

export { Button, type ButtonProps } from './Button';
export { Field, Input, Select, Textarea } from './Field';
export type { FieldProps, InputProps, SelectProps, TextareaProps } from './Field';
export { Card, CardHeader, CardBody, CardFooter, StatCard } from './Card';
export type { CardProps, StatCardProps } from './Card';
export { Badge, StockBadge } from './Badge';
export type { BadgeProps, StockBadgeProps } from './Badge';
export { Modal, type ModalProps } from './Modal';
export {
  Table,
  TableWrapper,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableEmpty,
  TableLoading,
  TableSkeleton,
} from './Table';
export type { SortDirection, ThProps, TdProps, TrProps } from './Table';
export { Tooltip, type TooltipProps } from './Tooltip';
export { ThemeToggle } from './ThemeToggle';
