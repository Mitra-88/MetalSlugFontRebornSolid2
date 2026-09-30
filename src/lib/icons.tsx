import type { JSX } from "@solidjs/web";

export interface IconProps {
  size?: number;
  class?: string | Record<string, boolean | undefined> | (string | Record<string, boolean | undefined>)[];
}

function MaterialIcon(props: IconProps & { name: string }): JSX.Element {
  return (
    <span
      class={["material-icons-round", props.class ?? []]}
      style={{ "font-size": `${props.size ?? 24}px` }}
      aria-hidden="true"
    >
      {props.name}
    </span>
  );
}

const makeIcon = (name: string) => (props: IconProps): JSX.Element => <MaterialIcon name={name} {...props} />;

export const Activity = makeIcon("speed");
export const ArrowLeft = makeIcon("arrow_back");
export const Check = makeIcon("check");
export const ChevronDown = makeIcon("expand_more");
export const Download = makeIcon("download");
export const Image = makeIcon("image");
export const Info = makeIcon("info");
export const Moon = makeIcon("dark_mode");
export const Palette = makeIcon("palette");
export const Sun = makeIcon("light_mode");
export const TriangleAlert = makeIcon("warning");
