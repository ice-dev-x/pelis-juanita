export const UA = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const BASE_URL = "https://pelisjuanita.org";
const API_URL = "https://pelisjuanita.org/api/rest/v1";

// Función para mapear imágenes desde TheMovieDB (igual que el código de Kotlin)
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
      overview: item.overview || item.description || "" // El secreto que usaba Premiere
    };
  }).filter(i => i.ref !== null);
}

// --- HOME ---
export async function home() {
  const reqHeaders = { "User-Agent": UA, "Referer": `${BASE_URL}/` };
  
  const [moviesRes, seriesRes, animeRes] = await Promise.all([
    kino.fetch(`${API_URL}/listing?kind=movie&order=recent&limit=24&page=1`, { headers: reqHeaders }),
    kino.fetch(`${API_URL}/listing?kind=serie&order=recent&limit=24&page=1`, { headers: reqHeaders }),
    kino.fetch(`${API_URL}/listing?kind=anime&order=recent&limit=24&page=1`, { headers: reqHeaders })
  ]);

  const categories = [];

  if (moviesRes.ok) {
    const moviesJson = await moviesRes.json();
    categories.push({ id: "h-movies", title: "Películas Recientes", ref: "movie", items: extractItems(moviesJson.items) });
  }
  if (seriesRes.ok) {
    const seriesJson = await seriesRes.json();
    categories.push({ id: "h-series", title: "Series Recientes", ref: "serie", items: extractItems(seriesJson.items) });
  }
  if (animeRes.ok) {
    const animeJson = await animeRes.json();
    categories.push({ id: "h-anime", title: "Anime", ref: "anime", items: extractItems(animeJson.items) });
  }

  return categories;
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
    // Exactamente igual al home
    const [estrenos, peliculas, series, animes, novelas, wwe, populares] = await Promise.all([
      fetchApiList(`${API_URL}/taxonomies/genre/estrenos?page=1&limit=24`),
      fetchApiList(`${API_URL}/listing?kind=movie&order=recent&limit=24&page=1`),
      fetchApiList(`${API_URL}/listing?kind=serie&order=recent&limit=24&page=1`),
      fetchApiList(`${API_URL}/listing?kind=anime&order=recent&limit=24&page=1`),
      fetchApiList(`${API_URL}/listing?kind=novel&order=recent&limit=24&page=1`),
      fetchApiList(`${API_URL}/listing?kind=wwe&order=recent&limit=24&page=1`),
      fetchApiList(`${API_URL}/listing?order=popular&limit=24&page=1`)
    ]);

    if (estrenos.length > 0) heroItem = estrenos[0];
    else if (peliculas.length > 0) heroItem = peliculas[0];

    if (estrenos.length > 0) rows.push({ id: "r-est", title: "Últimos Estrenos", ref: "genre-estrenos", items: estrenos });
    if (peliculas.length > 0) rows.push({ id: "r-mov", title: "Películas Recientes", ref: "peliculas", items: peliculas });
    if (series.length > 0) rows.push({ id: "r-ser", title: "Series Recientes", ref: "series", items: series });
    if (animes.length > 0) rows.push({ id: "r-ani", title: "Anime Reciente", ref: "anime", items: animes });
    if (novelas.length > 0) rows.push({ id: "r-nov", title: "Novelas Recientes", ref: "novelas", items: novelas });
    if (wwe.length > 0) rows.push({ id: "r-wwe", title: "WWE Reciente", ref: "wwe", items: wwe });
    if (populares.length > 0) rows.push({ id: "r-pop", title: "Populares", ref: "populares", items: populares });

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
    hero = { title: heroItem.title, text: "Explora este contenido destacado.", image: heroItem.backdrop || heroItem.poster };
  }

  return { tabs, tab: chosen, hero, rows };
}


// --- BROWSE (Paginación) ---
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
  else if (category.startsWith("genre-")) {
    const genreName = category.replace("genre-", "");
    apiUrl = `${API_URL}/taxonomies/genre/${genreName}?page=${page}&limit=30`;
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
  
  // 1. Armamos la metadata idéntica a Premiere
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
    
    // Esparcimos la metadata en la raíz para garantizar que Kino la lea
    return { 
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
    
    // Para series se mantiene igual
    return { 
      series: metadata, 
      episodes: episodesList 
    };
  }
}

export async function resolve(ref) {
  let initialUrl = ref;

  // 1. Autodetección si pasas la URL pública
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
  const allStreams = [];    // Aquí guardaremos todas las opciones para el botón HQ
  const allSubtitles = [];  // Aquí guardaremos los subtítulos para el botón CC

  // 2. Función recursiva modificada para recolectar TODO
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

      // Buscar subtítulos en el HTML (.vtt o .srt)
      const subRegex = /(?:file|src|url)["']?\s*:\s*["'](https?:\/\/[^"']+\.(?:vtt|srt)[^"']*)["']/gi;
      let subMatch;
      while ((subMatch = subRegex.exec(html)) !== null) {
        const subUrl = subMatch[1];
        if (!allSubtitles.find(s => s.url === subUrl)) {
          allSubtitles.push({ label: `Subtítulo ${allSubtitles.length + 1}`, url: subUrl });
        }
      }

      // Buscar Video Directo
      const findStream = (code) => {
        const m = code.match(/(?:file|src|url)["']?\s*:\s*["'](https?:\/\/[^"']+\.(?:m3u8|mp4|mpd)[^"']*)["']/i) || 
                  code.match(/https?:\/\/[^\s"'\\<>]+?\.(?:m3u8|mp4|mpd)(?:\?[^\s"'\\<>]*)?/i);
        return m ? (m[1] || m[0]) : null;
      };

      let streamUrl = findStream(html);

      // Desencriptar scripts protegidos si es necesario
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

      // SI ENCUENTRA VIDEO, LO GUARDA EN EL ARREGLO Y TERMINA ESTA RAMA
      if (streamUrl) {
        // Truco para limpiar el enlace maestro
        if (streamUrl.includes('.urlset/master.m3u8')) {
           //streamUrl = streamUrl.replace(/,[a-z,]+\.urlset\/master\.m3u8/, 'h/index.m3u8');
        }

        allStreams.push({
          label: `${hostName}`, // Nombre que saldrá en el menú HQ
          url: streamUrl,
          headers: { "User-Agent": UA, "Referer": currentOrigin + "/", "Origin": currentOrigin }
        });
        return; 
      }

      // Si no hay video, busca iframes internos y botones para seguir explorando
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

    } catch (e) {
      kino.log(`[Error] Fallo al explorar ${url}: ${e.message}`);
    }
  }

  // 3. Ejecutamos la búsqueda (ahora no se detiene, junta todos los servidores)
  await extractVideo(initialUrl, "https://pelisjuanita.org/", 0);

  // 4. CONSTRUCCIÓN DE LA RESPUESTA FINAL CON HQ Y CC
  if (allStreams.length > 0) {
    const primary = allStreams[0]; // El primer video inicia por defecto
    
    const finalResponse = {
      url: primary.url,
      headers: primary.headers
    };

    // Si encontró más de un servidor, llena el botón HQ
    if (allStreams.length > 1) {
      finalResponse.alternatives = allStreams.slice(1).map(s => ({
        label: s.label,
        url: s.url,
        headers: s.headers
      }));
    }

    // Si encontró subtítulos, llena el botón CC
    if (allSubtitles.length > 0) {
      finalResponse.subtitles = allSubtitles;
    }

    return finalResponse;
  }

  throw kino.error("unavailable", "No se pudo extraer el video. Los iframes internos pueden estar protegidos o caídos.");
}