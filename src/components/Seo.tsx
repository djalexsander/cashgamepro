import { Helmet } from "react-helmet-async";

const BASE_URL = "https://cashgamepro.lovable.app";

interface SeoProps {
  title: string;
  description: string;
  path: string;
}

const Seo = ({ title, description, path }: SeoProps) => {
  const url = `${BASE_URL}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
};

export default Seo;
