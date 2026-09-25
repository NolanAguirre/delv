import React, {useState} from 'react'
import {useQuery, useMutation} from 'delv/react'
import {GENRES_QUERY, CREATE_GENRE, UPDATE_GENRE, DELETE_GENRE} from '../queries.js'

const GenreRow = ({genre, onDelete, deleting}) => {
    const [updateGenre, {loading: saving}] = useMutation({mutation: UPDATE_GENRE})
    const [editing, setEditing] = useState(false)
    const [name, setName] = useState(genre.name)

    const books = (genre.booksByGenreId && genre.booksByGenreId.nodes) || []

    const onSave = () => {
        updateGenre({variables: {id: genre.id, patch: {name}}})
            .then(() => setEditing(false))
            .catch(() => {})
    }

    return (
        <li>
            {editing ? (
                <span>
                    <input value={name} onChange={(event) => setName(event.target.value)} />
                    <button type="button" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                    <button type="button" onClick={() => { setName(genre.name); setEditing(false) }}>Cancel</button>
                </span>
            ) : (
                <span>
                    <strong>{genre.name}</strong>
                    <button type="button" onClick={() => setEditing(true)} style={{marginLeft: 8}}>Rename</button>
                    <button type="button" onClick={() => onDelete(genre.id)} disabled={deleting} style={{marginLeft: 4}}>Delete</button>
                </span>
            )}
            {books.length ? (
                <ul>
                    {books.map((book) => (
                        <li key={book.id}>{book.title}</li>
                    ))}
                </ul>
            ) : (
                <em> — no books</em>
            )}
        </li>
    )
}

const NewGenreForm = () => {
    const [createGenre, {loading, error}] = useMutation({mutation: CREATE_GENRE})
    const [name, setName] = useState('')

    const onSubmit = (event) => {
        event.preventDefault()
        if(!name){
            return
        }
        createGenre({variables: {genre: {name}}})
            .then(() => setName(''))
            .catch(() => {})
    }

    return (
        <form onSubmit={onSubmit} style={{display: 'flex', gap: '0.5rem', marginBottom: '1rem'}}>
            <input placeholder="Genre name" value={name} onChange={(event) => setName(event.target.value)} />
            <button type="submit" disabled={loading}>{loading ? 'Adding…' : 'Add genre'}</button>
            {error ? <span style={{color: 'crimson'}}>{String(error.message || error)}</span> : null}
        </form>
    )
}

const Genres = () => {
    const {loading, error, data} = useQuery({query: GENRES_QUERY})
    const [deleteGenre, {loading: deleting, error: deleteError}] = useMutation({mutation: DELETE_GENRE})

    const onDelete = (id) => {
        deleteGenre({variables: {id}}).catch(() => {})
    }

    if(loading){
        return <p>Loading genres…</p>
    }
    if(error){
        return <p style={{color: 'crimson'}}>Error loading genres: {String(error.message || error)}</p>
    }

    const genres = (data && data.allGenres && data.allGenres.nodes) || []

    return (
        <div>
            <NewGenreForm />
            {deleteError ? <p style={{color: 'crimson'}}>Error deleting: {String(deleteError.message || deleteError)}</p> : null}
            <ul>
                {genres.map((genre) => (
                    <GenreRow key={genre.id} genre={genre} onDelete={onDelete} deleting={deleting} />
                ))}
            </ul>
        </div>
    )
}

export default Genres
