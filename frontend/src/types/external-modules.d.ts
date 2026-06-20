declare module 'genkit' {
  import * as z from 'zod';

  export interface GenkitConfig {
    // keep it loose but structured enough for our usage
    plugins?: unknown[];
    model?: string;
  }

  export function genkit(config: GenkitConfig): any;

  // Re-export zod's namespace so `z.infer` etc. work as expected.
  export { z };
}

declare module 'framer-motion' {
  // We only need basic React component/animation types; keep as `any` to avoid strict typing requirements.
  export const motion: any;
  export const AnimatePresence: any;
  export type Variants = any;
  export type Transition = any;
}

declare module '@dnd-kit/core' {
  export type DragEndEvent = any;
  export const DndContext: any;
  export const closestCenter: any;
  export const PointerSensor: any;
  export const KeyboardSensor: any;
  export const useSensor: any;
  export const useSensors: any;
}

declare module '@dnd-kit/sortable' {
  export const SortableContext: any;
  export const arrayMove: any;
  export const useSortable: any;
  export const sortableKeyboardCoordinates: any;
  export const verticalListSortingStrategy: any;
}

declare module 'react-hook-form' {
  // Minimal surface used in src/components/ui/form.tsx
  export type FieldValues = Record<string, any>;
  export type FieldPath<TFieldValues extends FieldValues> = keyof TFieldValues & string;

  export interface ControllerProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>> {
    name: TName;
    control?: any;
    rules?: any;
    defaultValue?: any;
    render: (props: any) => any;
  }

  export const Controller: <TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>(props: ControllerProps<TFieldValues, TName>) => any;
  export const FormProvider: React.ComponentType<any>;
  export function useFormContext(): any;
}

