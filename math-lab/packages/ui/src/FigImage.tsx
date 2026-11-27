// 静止図：端末がダークのときは暗い版（srcDark）を出す。選ぶのはページの media（<picture>）。
// SVG の中の prefers-color-scheme だけに頼らない：iPhone の Safari で、先に読んだ2枚目以降の図に効かず白く出た（stats2-course #582。2026-11-27）
import { forwardRef, type ImgHTMLAttributes } from "react";

type Props = ImgHTMLAttributes<HTMLImageElement> & { src: string; srcDark?: string };

export const FigImage = forwardRef<HTMLImageElement, Props>(function FigImage({ src, srcDark, ...rest }, ref) {
  if (!srcDark) return <img ref={ref} src={src} {...rest} />;
  return (
    <picture style={{ display: "contents" }}>
      <source srcSet={srcDark} media="(prefers-color-scheme: dark)" />
      <img ref={ref} src={src} {...rest} />
    </picture>
  );
});
