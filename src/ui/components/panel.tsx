import { type ComponentProps } from 'react';
import { twMerge } from 'tailwind-merge';

import { tw } from '@/ui/tw';

/** Props of `Panel` and its slots. */
export type PanelProps = ComponentProps<'section'>;

/** Props of `Panel.Header`. */
export type PanelHeaderProps = ComponentProps<'header'>;

/** Props of `Panel.Body`. */
export type PanelBodyProps = ComponentProps<'div'>;

/**
 * A square surface with a 1px border. Hierarchy comes from the rule between
 * header and body, not from boxes inside boxes.
 * `className` is merged over the panel styles; `ref` is the `<section>`.
 *
 * @example
 * <Panel>
 *   <Panel.Header>Title</Panel.Header>
 *   <Panel.Body>Content</Panel.Body>
 * </Panel>
 */
export function Panel({ className, ...props }: PanelProps) {
  return (
    <section
      className={twMerge(
        tw`flex flex-col border border-gray-300 bg-gray-0 text-gray-1000`,
        className,
      )}
      {...props}
    />
  );
}

/** The panel's header row, separated from the body by a rule. */
Panel.Header = function PanelHeader({ className, ...props }: PanelHeaderProps) {
  return (
    <header
      className={twMerge(
        tw`flex items-center justify-between gap-3 border-b border-gray-300 px-5 py-3`,
        className,
      )}
      {...props}
    />
  );
};

/** The panel's content. */
Panel.Body = function PanelBody({ className, ...props }: PanelBodyProps) {
  return <div className={twMerge(tw`px-5 py-4`, className)} {...props} />;
};
