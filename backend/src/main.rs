use axum::{routing::{get, post}, Router};
use std::net::SocketAddr;
use backend::check_answer::api_check_answer;
use backend::get_target::api_get_target;

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(health))
        .route("/api/checkAnswer", post(api_check_answer))
        .route("/api/getTarget", post(api_get_target))
    ;

    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    println!("Listening on http://{}", addr);

    axum::serve(tokio::net::TcpListener::bind(addr).await.unwrap(), app)
        .await
        .unwrap();
}

async fn health() -> &'static str {
    "OK"
}
