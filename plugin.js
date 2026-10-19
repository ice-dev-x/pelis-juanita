export const UA = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const BASE_URL = "https://pelisjuanita.org";
const API_URL = "https://pelisjuanita.org/api/rest/v1";

// Función para mapear imágenes desde TheMovieDB
function getImgUrl(path, size = "w500") {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/${size}/${path.replace(/^\//, '')}`;
}

// Convertidor de JSON a formato Kino
function extractItems(items) {
  if (!items || !Array.isArray(items)) return [];
  
  return items.map(item => {
    const isSerie = item.kind !== "movie" && item.kind !== "wwe";
    const refUrl = item.url ? (item.url.startsWith("http") ? item.url : `${BASE_URL}${item.url}`) : null;
    
    const posterImg = getImgUrl(item.poster_path, "w500");
    const backdropImg = getImgUrl(item.backdrop_path, "w780") || posterImg; 
    
    return {
      id: `pj-${item.catalog_item_id || item.title.replace(/\s+/g, '-')}`,
      ref: refUrl,
      title: item.title,
      kind: isSerie ? "series" : "movie",
      poster: posterImg,
      backdrop: backdropImg,
      year: item.year ? parseInt(item.year, 10) : null,
      overview: item.overview || item.description || ""
    };
  }).filter(i => i.ref !== null);
}

// --- HOME ---
export async function home() {
  try {
    const res = await kino.fetch(`${API_URL}/home`, { 
      headers: { "User-Agent": UA, "Referer": `${BASE_URL}/` } 
    });
    if (!res.ok) return [];
    const json = await res.json();
    
    const categories = [];
    const currentYear = new Date().getFullYear();

    try {
      const yearRes = await kino.fetch(`${API_URL}/taxonomies/year/${currentYear}?page=1&limit=30`, { 
        headers: { "User-Agent": UA, "Referer": `${BASE_URL}/` } 
      });
      if (yearRes.ok) {
        const yearJson = await yearRes.json();
        if (yearJson.items && yearJson.items.length > 0) {
          categories.push({
            id: `row-estrenos-year`,
            title: `Estrenos ${currentYear}`,
            ref: `year-${currentYear}`, 
            items: extractItems(yearJson.items)
          });
        }
      }
    } catch (e) {}

    if (json.rows && Array.isArray(json.rows)) {
      for (const row of json.rows) {
        if (row.items && row.items.length > 0) {
          let refTarget = "peliculas";
          const lowerTitle = String(row.title || "").toLowerCase();
          
          if (lowerTitle.includes("popular")) continue;

          if (lowerTitle.includes("serie")) refTarget = "series";
          else if (lowerTitle.includes("anime")) refTarget = "anime";
          else if (lowerTitle.includes("novela")) refTarget = "novelas";
          else if (lowerTitle.includes("wwe")) refTarget = "wwe";
          else if (lowerTitle.includes("estreno")) refTarget = "genre-estrenos";

          categories.push({
            id: row.config && row.config.id ? row.config.id : `row-${categories.length}`,
            title: row.title,
            ref: refTarget,
            items: extractItems(row.items)
          });
        }
      }
    }
    return categories;
  } catch (e) {
    return [];
  }
}

// --- SECCIÓN (Pestañas Superiores) ---
export async function section({ tab } = {}) {
  const tabs = [
    { id: "inicio", label: "Inicio" },
    { id: "peliculas", label: "Películas" },
    { id: "series", label: "Series" },
    { id: "anime", label: "Anime" },
    { id: "generos", label: "Géneros" }
  ];

  const chosen = tabs.some((t) => t.id === tab) ? tab : "inicio";
  const reqHeaders = { "User-Agent": UA, "Referer": `${BASE_URL}/` };
  const currentYear = new Date().getFullYear();
  
  const rows = [];
  let heroItem = null;

  const fetchApiList = async (url) => {
    try {
      const res = await kino.fetch(url, { headers: reqHeaders });
      if (res.ok) {
        const json = await res.json();
        return extractItems(json.items || []);
      }
    } catch (e) {}
    return [];
  };

  if (chosen === "inicio") {
    try {
      const res = await kino.fetch(`${API_URL}/home`, { headers: reqHeaders });
      if (res.ok) {
        const json = await res.json();
        
        if (json.hero && json.hero.items && json.hero.items.length > 0) {
          heroItem = json.hero.items[0];
        }

        try {
          const yearItems = await fetchApiList(`${API_URL}/taxonomies/year/${currentYear}?page=1&limit=30`);
          if (yearItems.length > 0) {
            rows.push({
              id: `r-estrenos-year`,
              title: `Estrenos ${currentYear}`,
              ref: `year-${currentYear}`, 
              items: yearItems
            });
          }
        } catch(e) {}

        if (json.rows && Array.isArray(json.rows)) {
          for (const row of json.rows) {
            if (row.items && row.items.length > 0) {
              let refTarget = "peliculas";
              const lowerTitle = String(row.title || "").toLowerCase();
              
              if (lowerTitle.includes("popular")) continue;

              if (lowerTitle.includes("serie")) refTarget = "series";
              else if (lowerTitle.includes("anime")) refTarget = "anime";
              else if (lowerTitle.includes("novela")) refTarget = "novelas";
              else if (lowerTitle.includes("wwe")) refTarget = "wwe";
              else if (lowerTitle.includes("estreno")) refTarget = "genre-estrenos";

              rows.push({
                id: row.config && row.config.id ? row.config.id : `r-${rows.length}`,
                title: row.title,
                ref: refTarget,
                items: extractItems(row.items)
              });
            }
          }
        }
      }
    } catch (e) {}
  } 
  else if (chosen === "generos") {
    const [terror, animacion, fantasia] = await Promise.all([
      fetchApiList(`${API_URL}/taxonomies/genre/terror?page=1&limit=30`),
      fetchApiList(`${API_URL}/taxonomies/genre/animacion?page=1&limit=30`),
      fetchApiList(`${API_URL}/taxonomies/genre/fantasia?page=1&limit=30`)
    ]);

    if (terror.length > 0) heroItem = terror[0];

    if (terror.length > 0) rows.push({ id: "r-terror", title: "Terror", ref: "genre-terror", items: terror });
    if (animacion.length > 0) rows.push({ id: "r-anim", title: "Animación", ref: "genre-animacion", items: animacion });
    if (fantasia.length > 0) rows.push({ id: "r-fan", title: "Fantasía", ref: "genre-fantasia", items: fantasia });
  } 
  else {
    const kindMap = { "peliculas": "movie", "series": "serie", "anime": "anime" };
    const items = await fetchApiList(`${API_URL}/listing?kind=${kindMap[chosen]}&order=recent&limit=24&page=1`);
    
    if (items.length > 0) heroItem = items[0];
    const rowTitle = tabs.find(t => t.id === chosen).label;
    if (items.length > 0) rows.push({ id: `r-${chosen}`, title: `Catálogo de ${rowTitle}`, ref: chosen, items: items });
  }

  let hero = { title: "Pelis Juanita", text: "El mejor entretenimiento." };
  if (heroItem) {
    hero = { 
      title: heroItem.title, 
      text: heroItem.overview || "Explora este contenido destacado.", 
      image: getImgUrl(heroItem.backdrop_path || heroItem.backdrop, "w1280") || getImgUrl(heroItem.poster_path || heroItem.poster, "w500") 
    };
  }

  return { tabs, tab: chosen, hero, rows };
}

// --- BROWSE ---
export async function browse(ref, cursor) {
  const page = cursor ? parseInt(cursor, 10) : 1;
  const category = ref || "peliculas"; 
  
  const kindMap = { "peliculas": "movie", "series": "serie", "anime": "anime", "novelas": "novel", "wwe": "wwe" };
  let apiUrl = "";

  if (kindMap[category]) {
    apiUrl = `${API_URL}/listing?kind=${kindMap[category]}&order=recent&limit=24&page=${page}`;
  } 
  else if (category === "populares") {
    apiUrl = `${API_URL}/listing?order=popular&limit=24&page=${page}`;
  }
  else if (category === "genre-estrenos") {
    apiUrl = `${API_URL}/listing?kind=movie&order=trending_7d&limit=24&page=${page}`;
  }
  else if (category.startsWith("genre-")) {
    const genreName = category.replace("genre-", "");
    apiUrl = `${API_URL}/taxonomies/genre/${genreName}?page=${page}&limit=30`;
  } 
  else if (category.startsWith("year-")) {
    const yearValue = category.replace("year-", "");
    apiUrl = `${API_URL}/taxonomies/year/${yearValue}?page=${page}&limit=30`;
  }
  else {
    return { items: [] };
  }

  const res = await kino.fetch(apiUrl, { headers: { "User-Agent": UA, "Referer": `${BASE_URL}/` } });
  if (!res.ok) return { items: [] };
  const json = await res.json();
  
  return { 
    items: extractItems(json.items), 
    next: (json.pagination && json.pagination.has_next) ? String(page + 1) : null 
  };
}

// --- BUSCADOR ---
export async function search(query) {
  if (!query || !query.q) return [];
  const term = encodeURIComponent(query.q);
  
  try {
    const res = await kino.fetch(`${API_URL}/search?q=${term}`, { 
      headers: { "User-Agent": UA, "Referer": `${BASE_URL}/` } 
    });
    if (res.ok) {
      const json = await res.json();
      return extractItems(json.items);
    }
  } catch (e) {}
  
  return [];
}

// --- METADATOS Y EPISODIOS ---
export async function episodes(ref) {
  const urlObj = new URL(ref);
  const parts = urlObj.pathname.split('/').filter(Boolean);
  
  const kindMap = { "pelicula": "movie", "serie": "serie", "anime": "anime", "novela": "novel", "wwe": "wwe" };
  const routeKind = parts[0];
  const slug = parts[1];
  const apiKind = kindMap[routeKind] || "movie";
  
  const reqHeaders = { "User-Agent": UA, "Referer": `${BASE_URL}/` };
  
  const res = await kino.fetch(`${API_URL}/content/${apiKind}/${slug}`, { headers: reqHeaders });
  if (!res.ok) throw kino.error("not_found", "Ficha no disponible en Pelis Juanita");
  
  const json = await res.json();
  const item = json.item;
  
  const metadata = {
    overview: item.overview || "",
    year: item.year ? parseInt(item.year, 10) : null,
    poster: getImgUrl(item.poster_path),
    backdrop: getImgUrl(item.backdrop_path, "w1280"),
    genres: json.genres ? json.genres.map(g => g.title) : []
  };

 const episodesList = [];
  const isMovie = apiKind === "movie" || apiKind === "wwe";

  if (isMovie) {
    episodesList.push({
      season: 1,
      number: 1,
      ref: item.player_url || ref, 
      title: "Reproducir Película",
      overview: metadata.overview
    });
    
    return { 
      movie: metadata, 
      overview: metadata.overview,
      year: metadata.year,
      poster: metadata.poster,
      backdrop: metadata.backdrop,
      genres: metadata.genres,
      episodes: episodesList 
    };
    
  } else {
    const itemId = item.catalog_item_id;
    const seasonsRes = await kino.fetch(`${API_URL}/episode-seasons?item_id=${itemId}`, { headers: reqHeaders });
    
    if (seasonsRes.ok) {
      const seasonsJson = await seasonsRes.json();
      const seasons = seasonsJson.seasons || [];
      
      for (const seasonObj of seasons) {
        const seasonNum = seasonObj.season;
        let page = 1;
        let hasNext = true;
        
        while (page <= 200 && hasNext) {
          const epRes = await kino.fetch(`${API_URL}/episodes?item_id=${itemId}&season=${seasonNum}&limit=100&page=${page}`, { headers: reqHeaders });
          if (!epRes.ok) break;
          
          const epJson = await epRes.json();
          const eps = epJson.episodes || [];
          
          for (const ep of eps) {
            if (!ep.playable) continue;
            
            episodesList.push({
              season: seasonNum,
              number: ep.episode,
              ref: ep.player_url || ref,
              title: ep.title || `Episodio ${ep.episode}`,
              overview: ep.overview || "",
              still: getImgUrl(ep.still_path)
            });
          }
          
          hasNext = epJson.pagination && epJson.pagination.has_next;
          page++;
        }
      }
    }
    
    episodesList.sort((a, b) => (a.season - b.season) || (a.number - b.number));
    
    return { 
      series: metadata, 
      episodes: episodesList 
    };
  }
}

// --- EXTRACTOR DE VIDEO MULTI-SERVIDOR ---
export async function resolve(ref) {
  let initialUrl = ref;

  if (ref.includes("/pelicula/") || ref.includes("/serie/") || ref.includes("/anime/") || ref.includes("/wwe/")) {
    const urlObj = new URL(ref);
    const parts = urlObj.pathname.split('/').filter(Boolean);
    const kindMap = { "pelicula": "movie", "serie": "serie", "anime": "anime", "novela": "novel", "wwe": "wwe" };
    const apiKind = kindMap[parts[0]] || "movie";
    const slug = parts[1];

    try {
      const apiRes = await kino.fetch(`https://pelisjuanita.org/api/rest/v1/content/${apiKind}/${slug}`, {
        headers: { "User-Agent": UA, "Referer": "https://pelisjuanita.org/" }
      });
      if (apiRes.ok) {
        const json = await apiRes.json();
        if (json.item && json.item.player_url) {
          initialUrl = json.item.player_url;
        }
      }
    } catch (e) { }
  }

  const visited = new Set();
  const allStreams = []; 

  async function extractVideo(url, referer, depth) {
    if (depth > 3 || visited.has(url)) return; 
    visited.add(url);

    if (url.startsWith("//")) url = "https:" + url;

    const originMatch = url.match(/^(https?:\/\/[^\/]+)/i);
    const currentOrigin = originMatch ? originMatch[1] : url;
    const reqHeaders = { "User-Agent": UA, "Referer": referer };
    
    const hostName = new URL(currentOrigin).hostname.replace('www.', '');

    try {
      const res = await kino.fetch(url, { headers: reqHeaders, timeoutMs: 10000 });
      if (!res.ok) return;
      const html = await res.text();

      const findStream = (code) => {
        const m = code.match(/(?:file|src|url)["']?\s*:\s*["'](https?:\/\/[^"']+\.(?:m3u8|mp4|mpd)[^"']*)["']/i) || 
                  code.match(/https?:\/\/[^\s"'\\<>]+?\.(?:m3u8|mp4|mpd)(?:\?[^\s"'\\<>]*)?/i);
        return m ? (m[1] || m[0]) : null;
      };

      let streamUrl = findStream(html);

      if (!streamUrl) {
        const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
        if (scripts) {
          for (const s of scripts) {
            if (s.includes('eval(function(p,a,c,k,e,d)')) {
              const packerMatch = s.match(/eval\((function\(p,a,c,k,e,d\)[\s\S]+)\)/);
              if (packerMatch) {
                try {
                  const unpackedCode = new Function("return (" + packerMatch[1] + ");")();
                  streamUrl = findStream(unpackedCode);
                  if (streamUrl) break;
                } catch (err) {}
              }
            }
          }
        }
      }

      if (streamUrl) {
        allStreams.push({ 
          label: hostName, 
          url: streamUrl, 
          headers: { "User-Agent": UA, "Referer": currentOrigin + "/", "Origin": currentOrigin } 
        });
        return; 
      }

      const iframeRegex = /<iframe[^>]+src=["'](http[^"']+)["']/gi;
      let iframeMatch;
      while ((iframeMatch = iframeRegex.exec(html)) !== null) {
        let nextUrl = iframeMatch[1].replace(/&amp;/g, "&");
        await extractVideo(nextUrl, currentOrigin + "/", depth + 1);
      }

      const dataLinkRegex = /(?:data-link|data-url|data-server)=["'](http[^"']+)["']/gi;
      let dlMatch;
      while ((dlMatch = dataLinkRegex.exec(html)) !== null) {
        let nextUrl = dlMatch[1].replace(/&amp;/g, "&");
        await extractVideo(nextUrl, currentOrigin + "/", depth + 1);
      }

    } catch (e) {}
  }

  await extractVideo(initialUrl, "https://pelisjuanita.org/", 0);

  if (allStreams.length > 0) {
    const primary = allStreams[0];
    const finalResponse = {
      url: primary.url,
      headers: primary.headers
    };

    if (allStreams.length > 1) {
      finalResponse.alternatives = allStreams.slice(1).map(s => ({
        label: s.label,
        url: s.url,
        headers: s.headers
      }));
    }

    return finalResponse;
  }

  // Si no se encontró nada por HTTP, usamos el navegador como último recurso
  try {
    const page = await kino.browser.capture(initialUrl, { timeoutMs: 25000 });
    if (page && page.media && page.media.length > 0) {
      const validMedia = page.media.find(m => m.url.includes('.m3u8') || m.url.includes('.mp4')) || page.media[0];
      return { url: validMedia.url, headers: validMedia.headers || { "User-Agent": UA, "Referer": initialUrl } };
    }
  } catch(e) {}

  throw kino.error("unavailable", "No se pudo extraer el video. Los servidores pueden estar caídos.");
}