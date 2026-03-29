# hackPHS 2026

## Local development

Run the site locally with Python:

```bash
python wsgi.py
```

Then open `http://localhost:3000`.

## Files that matter

- `index.html` has the content and structure.
- `styles.css` handles the visuals and the space-to-sky theme.
- `main.js` runs the intro, the star field, the scroll updates, and the interest form behavior.

## Interest form

The interest form currently posts to `event@hackphs.tech` through FormSubmit.
The first live submission may ask that inbox to confirm the form before entries start forwarding normally.

## Visual asset notes

The current hero and sky scene are built directly in `index.html` and `styles.css` with inline SVG plus CSS layers, so there are no external visual dependencies for those pieces right now.
