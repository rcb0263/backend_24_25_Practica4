import {MongoClient, ObjectId} from "mongodb"
import { CartProduct, Carts, OrderProduct, Products } from "./types.ts";
import { Orders } from "./types.ts";

const url = Deno.env.get("N_MONGO")
if(!url){
  console.error("Debes definir la variable URL_MONGO")
  Deno.exit(1)
}
console.info(url)
const client = new MongoClient(url);

const handler = async (req: Request) : Promise<Response> =>{

  const biblioteca = client.db("pract_4");

  const usersCollection = biblioteca.collection("Users");
  const productsCollection = biblioteca.collection("Products");
  const cartsCollection = biblioteca.collection("Carts");
  const ordersCollection = biblioteca.collection("Orders");

  const Method = req.method
  const url = new URL(req.url)
  const path = url.pathname


  if(Method === "POST"){
    if(path === "/users"){//FUNCIONA
      const user =await req.json()
      if (!user.name || !user.email || !user.password) {
        return new Response("Bad request", { status: 400 });
      }
      const userDB = await usersCollection.findOne({
        email: user.email,
      });
      if (userDB) return new Response("User already exists", { status: 409 });
      const { insertedId } = await usersCollection.insertOne({
        name: user.name,
        email: user.email,
        password: user.password,
      });
      return new Response(
        JSON.stringify({
          id: insertedId,
          name: user.name,
          email: user.email,
          password: user.password          
        }),
        { status: 201 }
      );
    }else if(path === "/products"){//FUNCIONA
      const product =await req.json()
      if (!product.name || !product.price|| !product.stock) {
        return new Response("Bad request", { status: 400 });
      }
      let description = "";
      if(product.description ){
        description = product.description
      }
      const { insertedId } = await productsCollection.insertOne({
        name: product.name,
        description: product.description,
        price:  Number(product.price),
        stock: Number(product.stock)
      });
      return new Response(
        JSON.stringify({
          id: insertedId,
          name: product.name,
          description: product.description,
          price:  Number(product.price),
          stock: Number(product.stock)      
        }),
        { status: 201 }
      );
    }else if(path.startsWith("/carts/products")){//FUNCIONA
      const id = url.searchParams.get("userId");
      if (!id)  return new Response("Bad request", { status: 400 });
      const cart: CartProduct =await req.json()
      if (!cart.productId || !cart.quantity) {
        return new Response("Bad request", { status: 400 });
      }
     
      const cartDB = await cartsCollection.findOne({
        userId: id,
      });
      if (cartDB){
        
        const productos: CartProduct[] = cartDB.products
       const index =  productos.findIndex( (p: CartProduct) => p.productId === cart.productId)
      if(index >= 0){
        productos[index].quantity = cart.quantity
      } else {
        productos.push({
          productId: cart.productId,
          quantity: cart.quantity
        })
      }
      const aux: Carts = {
        products: productos,
        userId: id
      }

      const { modifiedCount } = await cartsCollection.updateOne(
        { _id: new ObjectId(cartDB._id as string)},
        { $set: aux } );

      }else{
        const { insertedId } = await cartsCollection.insertOne({
          userId: id,
          products: [
            {
              productId: cart.productId,
              quantity: cart.quantity
            }
          ],
        });
      }
      const listaproducts: CartProduct[] = cartDB.products;

      const productos: Products[] = await Promise.all(
        listaproducts.map(async (p) => {
          const res:Products = await productsCollection.findOne({ _id: new ObjectId(p.productId) });
          return res;
        })
      );

      return new Response(
        JSON.stringify({
          userId: id,
          products: listaproducts.map((p, index) => ({
            productId: p.productId, 
            name: productos[index]?.name, 
            quantity: p.quantity,
            price: (productos[index]?.price * p.quantity),
          }))
        }),
        { status: 201 }
      );
    }else if(path.startsWith("/orders")){//FUNCIONA
      const userId =  url.searchParams.get("userId"); 

      const cartDB: Carts = await cartsCollection.findOne({ userId: userId });
      
      if (cartDB) {
        let totalP = 0;
        if(cartDB.products.length === 0){
          return new Response("Carrito vacio")
        }
        const productosPromises = cartDB.products.map(async (p: CartProduct) => {
          const productoDB = await productsCollection.findOne({ _id: new ObjectId(p.productId) });
          
          if (!productoDB) {
            throw new Error(`Product not found: ${p.productId}`);
          }
          if (p.quantity <= productoDB.stock) {
            const price = productoDB.price;
            const totalPriceForProduct = price * p.quantity;

            productoDB.stock -= p.quantity;
            
            await productsCollection.updateOne(
              { _id: new ObjectId(p.productId) },
              { $set: { stock: productoDB.stock } }
            );

            totalP += totalPriceForProduct;
      
            return {
              productId: p.productId,
              name: productoDB.name,
              quantity: p.quantity,
              price: totalPriceForProduct,
            };
          } else {
            throw new Error(`Not enough stock for product: ${p.productId}`);
          }
        });
      
          const productoslist = await Promise.all(productosPromises);
      
          const order = {
            userId: cartDB.userId,
            products: productoslist.map(p => ({
              productId: p.productId,
              //name: p.name,
              quantity: p.quantity,
              price: p.price,  
            })),
            total: totalP, 
            orderDate: new Date(),
          };
          
                    
          const orderExists = await ordersCollection.findOne({ userId:userId });
          if(orderExists){
            await ordersCollection.deleteOne({ userId: userId });
          }
          const orderResult = await ordersCollection.insertOne(order);
      
          return new Response(
            JSON.stringify({
              orderId: orderResult.insertedId,
              userId: cartDB.userId,
              products: productoslist,  
              total: totalP, 
              orderDate: order.orderDate,
            }),
            { status: 200 }
          );

      } else {
        return new Response("Cart not found", { status: 404 });
      }
      

    }else{
      return new Response("Error: wrong path")
    }
  }else if(Method === "GET"){
    if(path === "/users"){//FUNCIONA
      let lista = await usersCollection.find().toArray();
      return new Response(JSON.stringify(lista), {
        headers: {
          "content-type": "application/json"
        }
      })
    }else if (path === "/products"){//FUNCIONA
      let lista = await productsCollection.find().toArray();
      return new Response(JSON.stringify(lista), {
        headers: {
          "content-type": "application/json"
        }
      })
    }else if (path.startsWith("/carts")){//FUNCIONA
      const id = url.searchParams.get("userId");
      const cartDB:Carts = await cartsCollection.findOne({
        userId: id,
      });

      const listaproducts: CartProduct[] = cartDB.products;

      const productos: Products[] = await Promise.all(
        listaproducts.map(async (p) => {
          const res:Products = await productsCollection.findOne({ _id: new ObjectId(p.productId) });
          return res;
        })
      );

      return new Response(        
        JSON.stringify({
          userId: id,
          products: listaproducts.map((p, index) => ({
            productId: p.productId, 
            name: productos[index]?.name, 
            quantity: p.quantity,
            price: (productos[index]?.price * p.quantity),
          }))
        }), {
        headers: {
          "content-type": "application/json"
        }
      })
    }else if (path.startsWith("/orders")){//FUNCIONA
      const userId =  url.searchParams.get("userId"); 
      const orderDB:Orders = await ordersCollection.findOne({ userId:userId });

      const productosPromises = orderDB.products.map(async (p: OrderProduct) => {
        const productoDB = await productsCollection.findOne({ _id: new ObjectId(p.productId) });
        
        if (!productoDB) {
          throw new Error(`Product not found: ${p.productId}`);
        }
        return {
          productId: p.productId,
          name: productoDB.name,
          quantity: p.quantity,
          price: p.price,
        };
      });
      orderDB.products = await Promise.all(productosPromises);


      return new Response(
        JSON.stringify({
          orderId: orderDB.id,
          userId: orderDB.userId,
          products: orderDB.products,  
          total: orderDB.total, 
          date: orderDB.orderDate,
        }),
        { status: 200 }
      );
    }else{
      return new Response("Error: wrong path")
    }
  }else if(Method === "PUT"){
    if (path.startsWith("/products/")){//FUNCIONA
      const id = path.split("/").pop();
      if (!id) return new Response("Bad request", { status: 400 });
      const producto = await req.json();
      let aux = await productsCollection.findOne({_id: new ObjectId(id)});
      if(!aux){return new Response(" producto no encontrado", { status: 400 })}
      if(producto.name){
        aux.name = producto.name
      }
      if(producto.description){
        aux.description = producto.description
      }
      if(producto.price){
        aux.price = producto.price
      }
      if(producto.stock){
        aux.stock = producto.stock
      }
      const { modifiedCount } = await productsCollection.updateOne(
        { _id: new ObjectId(id as string)},
        { $set: aux } );

        return new Response(
          JSON.stringify({
            id: aux._id,
            name: aux.name,
            description: aux.description,
            price:  Number(aux.price),
            stock: Number(aux.stock)      
          }),
          { status: 201 }
        );

    }else{
      return new Response("Error: wrong path")
    }
  }else if(Method === "DELETE"){
    if (path.startsWith("/products/")){//FUNCIONA
      const id = path.split("/").pop()
      if (!id) return new Response("Bad request", { status: 400 });
      const res = await productsCollection.deleteOne({_id: new ObjectId(id)});
      if (res.deletedCount === 0){ 
        return new Response("Producto no encontradoe...", { status: 404 });
      }else{
        return new Response("Producto eliminado")
      }
    }else if (path.startsWith("/carts/products")){//FUNCIONA

      const productId =  url.searchParams.get("productId");
      const userId = url.searchParams.get("userId");
      const cartDB = await cartsCollection.findOne({
        userId: userId,
      });
      
      const updatedProducts = cartDB.products.filter((p:CartProduct) => p.productId !== productId);

      const Product = cartDB.products.filter((p:CartProduct) => p.productId === productId);
      const result = await cartsCollection.updateOne(
        { userId: userId },  // Filtro para encontrar el carrito del usuario
        { $set: { products: updatedProducts } }  // Usamos $set para actualizar el array 'products'
      );

      return new Response('Se ha eliminado el producto del carro')
    }else if (path.startsWith("/carts")){//FUNCIONA
      //Vacia completamente el carrito del usuario, asumo que es eliminar el objeto de la base de datos, en caso de eliminar los productos pero mantener el carrito, entonces es igual que el DELETE anterior, pero el array asignado con set debe estar vacio
      const userId = url.searchParams.get("userId");
      const cartDB = await cartsCollection.findOne({
        userId: userId,
      });
      if (!cartDB) {
        return new Response("Carrito no encontrado");
      }
      const result = await cartsCollection.updateOne(
        { userId: userId },  // Filtro para encontrar el carrito del usuario
        { $set: { products: [] } }  // Usamos $set para actualizar el array 'products'
      );

      return new Response('Sevaciado carro')
    }else{
      return new Response("Error: wrong path")
    }
  }
  return new Response("url: "+ req.url+"\nlength: "+req.url.length+"\nat 22: "+req.url.at(22)+"\npath: "+path)
}

Deno.serve({port: 3000}, handler);