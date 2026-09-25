// All GraphQL query/mutation strings for the lbry UI.
//
// CRITICAL formatting rule (delv network layer): AxiosWithErrors.post runs
// query.replace(/{(\n)/g, '{\n__typename\n'), so any `{` immediately followed
// by a newline gets __typename injected. That is what we want for selection
// sets, but it would corrupt GraphQL input objects. So:
//   - keep every selection-set `{` on its own line (newline right after it)
//   - keep mutation `input: {...}` braces INLINE and pass mutable fields via a
//     variable so no __typename lands inside an input object.

const BOOKS_QUERY = `
query Books {
  allBooks {
    nodes {
      id
      title
      isbn
      publishedDate
      authorByAuthorId {
        id
        firstName
        lastName
      }
      genreByGenreId {
        id
        name
      }
    }
  }
}
`

const AUTHORS_QUERY = `
query Authors {
  allAuthors {
    nodes {
      id
      firstName
      lastName
      bio
    }
  }
}
`

const GENRES_QUERY = `
query Genres {
  allGenres {
    nodes {
      id
      name
      booksByGenreId {
        nodes {
          id
          title
        }
      }
    }
  }
}
`

const USERS_QUERY = `
query Users {
  allUsers {
    nodes {
      id
      username
      fullName
      email
    }
  }
}
`

const CHECKOUTS_QUERY = `
query Checkouts($userId: UUID!) {
  allCheckouts(condition: {userId: $userId}) {
    nodes {
      id
      checkedOutAt
      dueAt
      bookCopyByBookCopyId {
        id
        barcode
        status
        bookByBookId {
          id
          title
        }
      }
    }
  }
}
`

const CHECKOUT_HISTORY_QUERY = `
query CheckoutHistory($userId: UUID!) {
  allCheckoutHistories(condition: {userId: $userId}) {
    nodes {
      id
      checkedOutAt
      dueAt
      returnedAt
      bookCopyByBookCopyId {
        id
        barcode
        bookByBookId {
          id
          title
        }
      }
    }
  }
}
`

const UPDATE_USER = `
mutation UpdateUser($id: UUID!, $patch: UserPatch!) {
  updateUserById(input: {id: $id, userPatch: $patch}) {
    user {
      id
      username
      fullName
      email
    }
  }
}
`

const RETURN_CHECKOUT = `
mutation ReturnCheckout($checkoutId: UUID!) {
  returnCheckout(input: {checkoutId: $checkoutId}) {
    checkoutHistory {
      id
      returnedAt
      userId
    }
  }
}
`

// Book create/update select the same fields as BOOKS_QUERY so the normalized
// entity is complete and cross-tab bylines/genre labels update from cache.
const CREATE_BOOK = `
mutation CreateBook($book: BookInput!) {
  createBook(input: {book: $book}) {
    book {
      id
      title
      isbn
      publishedDate
      authorByAuthorId {
        id
        firstName
        lastName
      }
      genreByGenreId {
        id
        name
      }
    }
  }
}
`

const UPDATE_BOOK = `
mutation UpdateBook($id: UUID!, $patch: BookPatch!) {
  updateBookById(input: {id: $id, bookPatch: $patch}) {
    book {
      id
      title
      isbn
      publishedDate
      authorByAuthorId {
        id
        firstName
        lastName
      }
      genreByGenreId {
        id
        name
      }
    }
  }
}
`

const DELETE_BOOK = `
mutation DeleteBook($id: UUID!) {
  deleteBookById(input: {id: $id}) {
    book {
      id
      __typename
    }
  }
}
`

const CREATE_GENRE = `
mutation CreateGenre($genre: GenreInput!) {
  createGenre(input: {genre: $genre}) {
    genre {
      id
      name
    }
  }
}
`

const UPDATE_GENRE = `
mutation UpdateGenre($id: UUID!, $patch: GenrePatch!) {
  updateGenreById(input: {id: $id, genrePatch: $patch}) {
    genre {
      id
      name
    }
  }
}
`

const DELETE_GENRE = `
mutation DeleteGenre($id: UUID!) {
  deleteGenreById(input: {id: $id}) {
    genre {
      id
      __typename
    }
  }
}
`

const CREATE_AUTHOR = `
mutation CreateAuthor($author: AuthorInput!) {
  createAuthor(input: {author: $author}) {
    author {
      id
      firstName
      lastName
      bio
    }
  }
}
`

const UPDATE_AUTHOR = `
mutation UpdateAuthor($id: UUID!, $patch: AuthorPatch!) {
  updateAuthorById(input: {id: $id, authorPatch: $patch}) {
    author {
      id
      firstName
      lastName
      bio
    }
  }
}
`

const DELETE_AUTHOR = `
mutation DeleteAuthor($id: UUID!) {
  deleteAuthorById(input: {id: $id}) {
    author {
      id
      __typename
    }
  }
}
`

export {
    BOOKS_QUERY,
    AUTHORS_QUERY,
    GENRES_QUERY,
    USERS_QUERY,
    CHECKOUTS_QUERY,
    CHECKOUT_HISTORY_QUERY,
    UPDATE_USER,
    RETURN_CHECKOUT,
    CREATE_BOOK,
    UPDATE_BOOK,
    DELETE_BOOK,
    CREATE_GENRE,
    UPDATE_GENRE,
    DELETE_GENRE,
    CREATE_AUTHOR,
    UPDATE_AUTHOR,
    DELETE_AUTHOR
}
