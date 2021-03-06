import * as testing from '@firebase/testing'
import { act, renderHook } from '@testing-library/react-hooks'
import assert from 'assert'
import { Collection, collection, ref, Ref, remove, set } from 'typesaurus'
import { setApp } from 'typesaurus/testing'
import useOnAll from '.'
import { lockDB } from '../../test/_lib/utils'

describe('useOnAll', () => {
  type Book = { title: string }
  type Order = { book: Ref<Book>; quantity: number; date?: Date }
  const books = collection<Book>('books')
  const orders = collection<Order>('orders')

  const date = new Date(1987, 1, 11)

  beforeEach(async () => {
    setApp(testing.initializeAdminApp({ projectId: 'project-id' }))

    await Promise.all([
      set(books, 'sapiens', { title: 'Sapiens' }),
      set(books, '22laws', { title: 'The 22 Immutable Laws of Marketing' }),
      set(books, 'momtest', { title: 'The Mom Test' }),
      remove(books, 'hp1'),
      set(orders, 'order1', {
        book: ref(books, 'sapiens'),
        quantity: 1,
        date
      }),
      set(orders, 'order2', {
        book: ref(books, '22laws'),
        quantity: 1,
        date
      })
    ])
  })

  it('returns all documents', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useOnAll(books))
    assert(result.current[0] === undefined)
    await waitForNextUpdate()
    const [docs] = result.current
    assert.deepEqual(docs!.map(({ data: { title } }) => title).sort(), [
      'Sapiens',
      'The 22 Immutable Laws of Marketing',
      'The Mom Test'
    ])
  })

  it('subscribes to real-time updates', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useOnAll(books))
    assert(result.current[0] === undefined)
    await waitForNextUpdate()
    assert.deepEqual(
      result.current[0]!.map(({ data: { title } }) => title).sort(),
      ['Sapiens', 'The 22 Immutable Laws of Marketing', 'The Mom Test']
    )
    await act(() =>
      set(books, 'hp1', {
        title: "Harry Potter and the Sorcerer's Stone"
      })
    )
    assert.deepEqual(
      result.current[0]!.map(({ data: { title } }) => title).sort(),
      [
        "Harry Potter and the Sorcerer's Stone",
        'Sapiens',
        'The 22 Immutable Laws of Marketing',
        'The Mom Test'
      ]
    )
  })

  it('cleans the data and refetch when the collection is changing', async () => {
    const initialProps: { collection: Collection<any> } = { collection: books }
    const { result, waitForNextUpdate, rerender } = renderHook(
      ({ collection }) => useOnAll(collection),
      { initialProps }
    )
    assert(result.current[0] === undefined)
    await waitForNextUpdate()
    assert(result.current[0])
    rerender({ collection: orders })
    assert(result.current[0] === undefined)
    await waitForNextUpdate()
    assert(result.current[0]![0].data.date.getTime() === date.getTime())
  })

  it('returns an empty array if the collection is empty', async () => {
    const { result, waitForNextUpdate } = renderHook(() =>
      useOnAll(collection('nope'))
    )
    await waitForNextUpdate()
    assert.deepEqual(result.current[0], [])
  })

  it('returns loading state', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useOnAll(books))
    assert(result.current[1].loading)
    await waitForNextUpdate()
    assert(!result.current[1].loading)
  })

  it('returns error state', async () => {
    await lockDB()
    const { result, waitForNextUpdate } = renderHook(() => useOnAll(books))
    assert(result.current[1].loading)
    assert(!result.current[1].error)
    await waitForNextUpdate()
    assert(!result.current[1].loading)

    assert(result.current[1].error)
  })
})
