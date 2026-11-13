//! Where models' weights live: ~/.cache/raea-feed/models/<name>/ (feed::cache), each file fetched once from Hugging
//! Face. RAEA_FEED_MODELS points somewhere else (a bench, a bundled app).

use std::path::{Path, PathBuf};

/// One model: a folder name and the Hugging Face files it needs (repo, path in the repo, local file name).
pub struct Spec {
    pub name: &'static str,
    pub files: &'static [(&'static str, &'static str, &'static str)],
}

pub fn root() -> PathBuf {
    if let Some(p) = crate::feed::var_os("MODELS") {
        return PathBuf::from(p);
    }
    crate::feed::cache().join("models")
}

/// The model's folder with every file present, downloading what's missing. `progress` gets (file, bytes so far).
pub fn ensure(spec: &Spec, progress: &mut dyn FnMut(&str, u64)) -> anyhow::Result<PathBuf> {
    let dir = root().join(spec.name);
    std::fs::create_dir_all(&dir)?;
    for (repo, path, local) in spec.files {
        let dest = dir.join(local);
        if dest.exists() {
            continue;
        }
        let url = format!("https://huggingface.co/{repo}/resolve/main/{path}");
        raea_io_home::offline(&format!("the {} model's {local} from {url}", spec.name)).map_err(|e| anyhow::anyhow!(e))?;
        fetch(&url, &dest, &mut |n| progress(local, n))?;
    }
    Ok(dir)
}

/// One file from a URL of its own (a model with no Hugging Face home, such as YAMNet from the public repo's models-1
/// release) into `<root>/<name>/<local>`, downloaded once. The caller checks what arrived.
pub fn ensure_url(name: &str, local: &str, url: &str, progress: &mut dyn FnMut(&str, u64)) -> anyhow::Result<PathBuf> {
    let dir = root().join(name);
    let dest = dir.join(local);
    if dest.exists() {
        return Ok(dest);
    }
    std::fs::create_dir_all(&dir)?;
    raea_io_home::offline(&format!("the {name} model's {local} from {url}")).map_err(|e| anyhow::anyhow!(e))?;
    fetch(url, &dest, &mut |n| progress(local, n))?;
    Ok(dest)
}

fn fetch(url: &str, dest: &Path, progress: &mut dyn FnMut(u64)) -> anyhow::Result<()> {
    use std::io::{Read, Write};
    let mut req = ureq::get(url);
    if let Ok(token) = std::env::var("HF_TOKEN") {
        req = req.set("Authorization", &format!("Bearer {token}"));
    }
    let resp = req.call().map_err(|e| anyhow::anyhow!("{url}: {e}"))?;
    let part = dest.with_extension("part");
    let mut out = std::fs::File::create(&part)?;
    let mut body = resp.into_reader();
    let mut buf = vec![0u8; 1 << 16];
    let mut total = 0u64;
    loop {
        let n = body.read(&mut buf)?;
        if n == 0 {
            break;
        }
        out.write_all(&buf[..n])?;
        total += n as u64;
        progress(total);
    }
    out.flush()?;
    std::fs::rename(&part, dest)?;
    Ok(())
}
