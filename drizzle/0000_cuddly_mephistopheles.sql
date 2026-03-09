CREATE TABLE "ai_analysis" (
	"id" serial PRIMARY KEY NOT NULL,
	"hot_search_id" integer,
	"needs_fact_check" boolean,
	"triage_reason" text,
	"category" varchar(50),
	"ai_model" varchar(50),
	"updated_at" timestamp DEFAULT now(),
	"is_clickbait" boolean,
	"score" integer,
	"reason" text,
	"deep_analysis" text,
	"verdict" text,
	"deep_ai_model" varchar(50),
	"deep_analyzed_at" timestamp,
	CONSTRAINT "ai_analysis_hot_search_id_unique" UNIQUE("hot_search_id")
);
--> statement-breakpoint
CREATE TABLE "hot_searches" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform_id" integer,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"heat_value" varchar(50),
	"rank" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "platforms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"display_name" varchar(50) NOT NULL,
	CONSTRAINT "platforms_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "ai_analysis" ADD CONSTRAINT "ai_analysis_hot_search_id_hot_searches_id_fk" FOREIGN KEY ("hot_search_id") REFERENCES "public"."hot_searches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hot_searches" ADD CONSTRAINT "hot_searches_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE no action ON UPDATE no action;