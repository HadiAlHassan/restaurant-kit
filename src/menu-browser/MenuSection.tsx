import { useMenuData } from "../menu/useMenuData";
import { MenuBrowser } from "./MenuBrowser";

export function MenuSection() {
  const { menu } = useMenuData();

  return <MenuBrowser menu={menu} />;
}
