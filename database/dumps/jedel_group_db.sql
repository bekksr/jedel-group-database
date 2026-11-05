--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.5

-- Started on 2026-11-05 23:00:12 +05

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 220 (class 1259 OID 24716)
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    product_id integer NOT NULL,
    product_name character varying(100) NOT NULL,
    category character varying(50),
    unit_price numeric(10,2) NOT NULL,
    stock_quantity integer DEFAULT 0 NOT NULL,
    CONSTRAINT products_stock_quantity_check CHECK ((stock_quantity >= 0)),
    CONSTRAINT products_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


ALTER TABLE public.products OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 24715)
-- Name: products_product_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.products ALTER COLUMN product_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.products_product_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 224 (class 1259 OID 24740)
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_order_items (
    item_id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    CONSTRAINT purchase_order_items_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT purchase_order_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


ALTER TABLE public.purchase_order_items OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 24739)
-- Name: purchase_order_items_item_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.purchase_order_items ALTER COLUMN item_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.purchase_order_items_item_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 222 (class 1259 OID 24725)
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_orders (
    order_id integer NOT NULL,
    supplier_id integer NOT NULL,
    order_date date DEFAULT CURRENT_DATE NOT NULL,
    status character varying(30) DEFAULT 'Pending'::character varying NOT NULL,
    expected_delivery_date date,
    CONSTRAINT chk_delivery_date CHECK (((expected_delivery_date IS NULL) OR (expected_delivery_date >= order_date))),
    CONSTRAINT purchase_orders_status_check CHECK (((status)::text = ANY ((ARRAY['Pending'::character varying, 'Approved'::character varying, 'Delivered'::character varying, 'Cancelled'::character varying])::text[])))
);


ALTER TABLE public.purchase_orders OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 24724)
-- Name: purchase_orders_order_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.purchase_orders ALTER COLUMN order_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.purchase_orders_order_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 218 (class 1259 OID 24708)
-- Name: suppliers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.suppliers (
    supplier_id integer NOT NULL,
    supplier_name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    phone character varying(20),
    address character varying(255)
);


ALTER TABLE public.suppliers OWNER TO postgres;

--
-- TOC entry 217 (class 1259 OID 24707)
-- Name: suppliers_supplier_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.suppliers ALTER COLUMN supplier_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.suppliers_supplier_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 3637 (class 0 OID 24716)
-- Dependencies: 220
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (product_id, product_name, category, unit_price, stock_quantity) FROM stdin;
3	Wireless Keyboard	Accessories	12000.00	50
4	Office Chair	Furniture	65000.00	12
5	Network Router	Networking	45000.00	20
1	Laptop Dell	Electronics	350000.00	17
2	Office Monitor	Electronics	85000.00	33
\.


--
-- TOC entry 3641 (class 0 OID 24740)
-- Dependencies: 224
-- Data for Name: purchase_order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_order_items (item_id, order_id, product_id, quantity, unit_price) FROM stdin;
1	1	1	2	350000.00
2	1	2	3	85000.00
3	2	3	10	12000.00
4	2	4	4	65000.00
5	3	3	5	12000.00
6	3	5	5	45000.00
\.


--
-- TOC entry 3639 (class 0 OID 24725)
-- Dependencies: 222
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_orders (order_id, supplier_id, order_date, status, expected_delivery_date) FROM stdin;
2	2	2026-10-30	Approved	2026-11-04
3	3	2026-10-30	Delivered	2026-10-30
1	1	2026-10-30	Delivered	2026-11-06
\.


--
-- TOC entry 3635 (class 0 OID 24708)
-- Dependencies: 218
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.suppliers (supplier_id, supplier_name, email, phone, address) FROM stdin;
1	TechnoSupply	techno@example.com	+77010000001	Almaty
2	Global Parts	global@example.com	+77010000002	Astana
3	Smart Logistics	smart@example.com	+77010000003	Shymkent
\.


--
-- TOC entry 3647 (class 0 OID 0)
-- Dependencies: 219
-- Name: products_product_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.products_product_id_seq', 5, true);


--
-- TOC entry 3648 (class 0 OID 0)
-- Dependencies: 223
-- Name: purchase_order_items_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.purchase_order_items_item_id_seq', 6, true);


--
-- TOC entry 3649 (class 0 OID 0)
-- Dependencies: 221
-- Name: purchase_orders_order_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.purchase_orders_order_id_seq', 3, true);


--
-- TOC entry 3650 (class 0 OID 0)
-- Dependencies: 217
-- Name: suppliers_supplier_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.suppliers_supplier_id_seq', 3, true);


--
-- TOC entry 3479 (class 2606 OID 24723)
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (product_id);


--
-- TOC entry 3483 (class 2606 OID 24746)
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (item_id);


--
-- TOC entry 3481 (class 2606 OID 24733)
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (order_id);


--
-- TOC entry 3475 (class 2606 OID 24714)
-- Name: suppliers suppliers_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_email_key UNIQUE (email);


--
-- TOC entry 3477 (class 2606 OID 24712)
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (supplier_id);


--
-- TOC entry 3485 (class 2606 OID 24748)
-- Name: purchase_order_items uq_order_product; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT uq_order_product UNIQUE (order_id, product_id);


--
-- TOC entry 3487 (class 2606 OID 24749)
-- Name: purchase_order_items fk_item_order; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT fk_item_order FOREIGN KEY (order_id) REFERENCES public.purchase_orders(order_id);


--
-- TOC entry 3488 (class 2606 OID 24754)
-- Name: purchase_order_items fk_item_product; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES public.products(product_id);


--
-- TOC entry 3486 (class 2606 OID 24734)
-- Name: purchase_orders fk_purchase_order_supplier; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT fk_purchase_order_supplier FOREIGN KEY (supplier_id) REFERENCES public.suppliers(supplier_id);


-- Completed on 2026-11-05 23:00:12 +05

--
-- PostgreSQL database dump complete
--

