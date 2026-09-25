import React, {useState} from 'react'
import {useQuery, useMutation} from 'delv/react'
import {
    BOOKS_QUERY,
    AUTHORS_QUERY,
    GENRES_QUERY,
    CREATE_BOOK,
    UPDATE_BOOK,
    DELETE_BOOK
} from '../queries.js'

const BookRow = ({book, onDelete, deleting}) => {
    const [updateBook, {loading: saving}] = useMutation({mutation: UPDATE_BOOK})
    const [editing, setEditing] = useState(false)
    const [title, setTitle] = useState(book.title)

    const author = book.authorByAuthorId
    const genre = book.genreByGenreId

    const onSave = () => {
        updateBook({variables: {id: book.id, patch: {title}}})
            .then(() => setEditing(false))
            .catch(() => {})
    }

    return (
        <li>
            {editing ? (
                <span>
                    <input value={title} onChange={(event) => setTitle(event.target.value)} />
                    <button type="button" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                    <button type="button" onClick={() => { setTitle(book.title); setEditing(false) }}>Cancel</button>
                </span>
            ) : (
                <span>
                    <strong>{book.title}</strong>
                    {author ? ` — ${author.firstName} ${author.lastName}` : ''}
                    {genre ? ` (${genre.name})` : ''}
                    <button type="button" onClick={() => setEditing(true)} style={{marginLeft: 8}}>Edit</button>
                    <button type="button" onClick={() => onDelete(book.id)} disabled={deleting} style={{marginLeft: 4}}>Delete</button>
                </span>
            )}
        </li>
    )
}

const NewBookForm = ({authors, genres}) => {
    const [createBook, {loading, error}] = useMutation({mutation: CREATE_BOOK})
    const [title, setTitle] = useState('')
    const [authorId, setAuthorId] = useState('')
    const [genreId, setGenreId] = useState('')

    const onSubmit = (event) => {
        event.preventDefault()
        if(!title || !authorId){
            return
        }
        const book = {title, authorId}
        if(genreId){
            book.genreId = genreId
        }
        createBook({variables: {book}})
            .then(() => {
                setTitle('')
                setAuthorId('')
                setGenreId('')
            })
            .catch(() => {})
    }

    return (
        <form onSubmit={onSubmit} style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem'}}>
            <input placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
            <select value={authorId} onChange={(event) => setAuthorId(event.target.value)}>
                <option value="">Select author…</option>
                {authors.map((author) => (
                    <option key={author.id} value={author.id}>{author.firstName} {author.lastName}</option>
                ))}
            </select>
            <select value={genreId} onChange={(event) => setGenreId(event.target.value)}>
                <option value="">No genre</option>
                {genres.map((genre) => (
                    <option key={genre.id} value={genre.id}>{genre.name}</option>
                ))}
            </select>
            <button type="submit" disabled={loading}>{loading ? 'Adding…' : 'Add book'}</button>
            {error ? <span style={{color: 'crimson'}}>{String(error.message || error)}</span> : null}
        </form>
    )
}

const Books = () => {
    const {loading, error, data} = useQuery({query: BOOKS_QUERY})
    const {data: authorsData} = useQuery({query: AUTHORS_QUERY})
    const {data: genresData} = useQuery({query: GENRES_QUERY})
    const [deleteBook, {loading: deleting, error: deleteError}] = useMutation({mutation: DELETE_BOOK})

    const onDelete = (id) => {
        deleteBook({variables: {id}}).catch(() => {})
    }

    if(loading){
        return <p>Loading books…</p>
    }
    if(error){
        return <p style={{color: 'crimson'}}>Error loading books: {String(error.message || error)}</p>
    }

    const books = (data && data.allBooks && data.allBooks.nodes) || []
    const authors = (authorsData && authorsData.allAuthors && authorsData.allAuthors.nodes) || []
    const genres = (genresData && genresData.allGenres && genresData.allGenres.nodes) || []

    return (
        <div>
            <NewBookForm authors={authors} genres={genres} />
            {deleteError ? <p style={{color: 'crimson'}}>Error deleting: {String(deleteError.message || deleteError)}</p> : null}
            <ul>
                {books.map((book) => (
                    <BookRow key={book.id} book={book} onDelete={onDelete} deleting={deleting} />
                ))}
            </ul>
        </div>
    )
}

export default Books
