using Chessss.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Chessss.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260417120000_AddPlayerProfileStats")]
    public partial class AddPlayerProfileStats : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Draws",
                table: "AspNetUsers",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "GamesPlayed",
                table: "AspNetUsers",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Losses",
                table: "AspNetUsers",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "NormalizedNickname",
                table: "AspNetUsers",
                type: "TEXT",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Wins",
                table: "AspNetUsers",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "UserNicknameIndex",
                table: "AspNetUsers",
                column: "NormalizedNickname",
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UserNicknameIndex",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "Draws",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "GamesPlayed",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "Losses",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "NormalizedNickname",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "Wins",
                table: "AspNetUsers");
        }
    }
}
