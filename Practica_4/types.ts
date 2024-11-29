import { ObjectId } from "mongodb";

export type BookModel={
    _id: ObjectId,
    tittle: string,
    author: string,
    year: number
}
export type Book={
    id: string,
    tittle: string,
    author: string,
    year: number
}


export type User={
    id?: string,
    name: string,
    email: string, //unique
    password: string
}

export type Products={
    _id?: string,
    name: string,
    description?: string,
    price: number,
    stock: number
}


export type Carts={
    id?: string,
    userId: string,
    products: CartProduct[]
}

export type CartProduct ={
    productId: string,
    quantity: number
}

export type Orders={
    id?: string,
    userId: string,
    products: OrderProduct[],
    total: number,
    orderDate: string
}
export type OrderProduct ={
    productId: string,
    quantity: number,
    price: number
}